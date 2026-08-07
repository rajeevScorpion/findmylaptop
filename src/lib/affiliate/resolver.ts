import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgentError } from "@/lib/growth-agents/errors";
import { getAgentSettings } from "@/lib/growth-agents/settings";
import type {
  GrowthAgentDatabaseClient,
  GrowthAgentSettings,
  SourceAdapterRecord,
} from "@/lib/growth-agents/types";
import {
  AFFILIATE_DISCLOSURE,
  affiliateCtaLabel,
  type AffiliateCtaMetadata,
  type AffiliatePlacement,
} from "./public";
import {
  canonicalizeSourceUrl,
  extractAmazonAsin,
  generateAffiliateUrl,
  getSourceLinkPolicy,
} from "./policies";

interface LaptopDestinationRow {
  id: string;
  slug: string;
  is_published: boolean;
  asin: string | null;
  amazon_affiliate_url: string | null;
}

interface ProductOfferRow {
  id: string;
  laptop_id: string | null;
  source_key: string;
  source_product_id: string | null;
  product_url: string;
  affiliate_url: string | null;
  price_amount: number | string | null;
  price_currency: string | null;
  price_fetched_at: string | null;
  availability: string | null;
  source_fetched_at: string;
  fresh_until: string | null;
  compliance_status: "safe" | "needs_review" | "blocked";
  is_active: boolean;
}

const PRODUCT_OFFER_SELECT =
  "id, laptop_id, source_key, source_product_id, product_url, affiliate_url, price_amount, price_currency, price_fetched_at, availability, source_fetched_at, fresh_until, compliance_status, is_active";

export interface ResolveAffiliateInput {
  laptopId: string;
  offerId?: string;
  placement: AffiliatePlacement;
}

export interface ResolvedAffiliateDestination {
  laptopId: string;
  offerId: string | null;
  sourceKey: string;
  destinationUrl: string;
  destinationHash: string;
  destinationKind: "affiliate" | "canonical";
  monetized: boolean;
  cta: AffiliateCtaMetadata;
}

export interface AffiliateResolverOptions {
  client?: GrowthAgentDatabaseClient;
  now?: Date;
}

function monetizationIsEnabled(settings: GrowthAgentSettings | null): boolean {
  return (
    settings?.affiliateLinksEnabled === true &&
    settings.safeMode === false &&
    settings.globalPause === false &&
    settings.emergencyStop === false
  );
}

function hashDestination(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function numeric(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getValidUntil(input: {
  evidenceAt: string;
  offerFreshUntil: string | null;
  source: SourceAdapterRecord;
  maxFreshnessMinutes: number;
  now: Date;
}): string | null {
  const evidenceAt = new Date(input.evidenceAt).getTime();
  if (!Number.isFinite(evidenceAt)) return null;
  const now = input.now.getTime();
  if (evidenceAt > now + 5 * 60_000) return null;
  const ttlMinutes = Math.min(
    input.source.freshness_ttl_minutes,
    input.maxFreshnessMinutes
  );
  let validUntil = evidenceAt + ttlMinutes * 60_000;
  if (input.offerFreshUntil) {
    const declared = new Date(input.offerFreshUntil).getTime();
    if (!Number.isFinite(declared)) return null;
    validUntil = Math.min(validUntil, declared);
  }
  return validUntil >= now ? new Date(validUntil).toISOString() : null;
}

function sourceEvidenceCanDisplay(source: SourceAdapterRecord | undefined): source is SourceAdapterRecord {
  return Boolean(
    source?.enabled &&
      source.public_display_allowed &&
      (source.credential_status === "valid" ||
        source.credential_status === "not_required")
  );
}

function getFreshPrice(
  offer: ProductOfferRow,
  source: SourceAdapterRecord | undefined,
  now: Date
): AffiliateCtaMetadata["price"] {
  const policy = getSourceLinkPolicy(offer.source_key);
  const amount = numeric(offer.price_amount);
  if (
    !policy ||
    !sourceEvidenceCanDisplay(source) ||
    amount === null ||
    !offer.price_currency ||
    !/^[A-Z]{3}$/.test(offer.price_currency) ||
    !offer.price_fetched_at ||
    offer.compliance_status !== "safe"
  ) {
    return null;
  }

  const fetchedAt = new Date(offer.price_fetched_at).getTime();
  if (!Number.isFinite(fetchedAt)) return null;
  const validUntil = getValidUntil({
    evidenceAt: offer.price_fetched_at,
    offerFreshUntil: offer.fresh_until,
    source,
    maxFreshnessMinutes: policy.maxPriceFreshnessMinutes,
    now,
  });
  if (!validUntil) return null;
  return {
    amount,
    currency: offer.price_currency,
    fetchedAt: offer.price_fetched_at,
    validUntil,
  };
}

function getFreshAvailability(
  offer: ProductOfferRow,
  source: SourceAdapterRecord | undefined,
  now: Date
): AffiliateCtaMetadata["availability"] {
  const policy = getSourceLinkPolicy(offer.source_key);
  const label = offer.availability?.trim();
  if (
    !policy ||
    !sourceEvidenceCanDisplay(source) ||
    offer.compliance_status !== "safe" ||
    !label ||
    label.length > 200
  ) {
    return null;
  }
  const validUntil = getValidUntil({
    evidenceAt: offer.source_fetched_at,
    offerFreshUntil: offer.fresh_until,
    source,
    maxFreshnessMinutes: policy.maxPriceFreshnessMinutes,
    now,
  });
  return validUntil
    ? { label, fetchedAt: offer.source_fetched_at, validUntil }
    : null;
}

function resolveOfferDestination(input: {
  offer: ProductOfferRow;
  source: SourceAdapterRecord | undefined;
  affiliateLinksEnabled: boolean;
  now: Date;
}): ResolvedAffiliateDestination | null {
  const { offer, source, affiliateLinksEnabled, now } = input;
  const policy = getSourceLinkPolicy(offer.source_key);
  if (
    !policy ||
    !offer.laptop_id ||
    !offer.is_active ||
    offer.compliance_status !== "safe"
  ) {
    return null;
  }

  const canonicalUrl =
    canonicalizeSourceUrl({
      sourceKey: offer.source_key,
      value: offer.product_url,
      sourceProductId: offer.source_product_id,
    }) ??
    (offer.affiliate_url
      ? canonicalizeSourceUrl({
          sourceKey: offer.source_key,
          value: offer.affiliate_url,
          sourceProductId: offer.source_product_id,
        })
      : null);
  if (!canonicalUrl) return null;

  const canMonetize =
    affiliateLinksEnabled &&
    source?.enabled === true &&
    source.public_display_allowed === true &&
    source.credential_status === "valid" &&
    policy.supportsAffiliateGeneration;
  const affiliateUrl = canMonetize
    ? generateAffiliateUrl({
        sourceKey: offer.source_key,
        canonicalUrl,
        sourceProductId: offer.source_product_id,
      })
    : null;
  const destinationUrl = affiliateUrl ?? canonicalUrl;
  const price = getFreshPrice(offer, source, now);
  const availability = getFreshAvailability(offer, source, now);
  const sourceName = source?.display_name ?? policy.displayName;

  return {
    laptopId: offer.laptop_id,
    offerId: offer.id,
    sourceKey: offer.source_key,
    destinationUrl,
    destinationHash: hashDestination(destinationUrl),
    destinationKind: affiliateUrl ? "affiliate" : "canonical",
    monetized: Boolean(affiliateUrl),
    cta: {
      label: affiliateCtaLabel(offer.source_key),
      sourceKey: offer.source_key,
      sourceName,
      priceFreshness: price
        ? "fresh"
        : offer.price_amount === null
          ? "unavailable"
          : "stale",
      price,
      availability,
      disclosure: AFFILIATE_DISCLOSURE,
    },
  };
}

function resolveLegacyAmazon(input: {
  laptop: LaptopDestinationRow;
  source: SourceAdapterRecord | undefined;
  affiliateLinksEnabled: boolean;
}): ResolvedAffiliateDestination | null {
  const { laptop, source, affiliateLinksEnabled } = input;
  const asin = extractAmazonAsin(
    laptop.asin,
    laptop.amazon_affiliate_url
  );
  if (!asin) return null;
  const canonicalUrl = canonicalizeSourceUrl({
    sourceKey: "amazon",
    value: `https://www.amazon.in/dp/${asin}`,
    sourceProductId: asin,
  });
  if (!canonicalUrl) return null;
  const affiliateUrl =
    affiliateLinksEnabled &&
    source?.enabled === true &&
    source.public_display_allowed === true &&
    source.credential_status === "valid"
      ? generateAffiliateUrl({
          sourceKey: "amazon",
          canonicalUrl,
          sourceProductId: asin,
        })
      : null;
  const destinationUrl = affiliateUrl ?? canonicalUrl;
  const sourceName = source?.display_name ?? "Amazon India";
  return {
    laptopId: laptop.id,
    offerId: null,
    sourceKey: "amazon",
    destinationUrl,
    destinationHash: hashDestination(destinationUrl),
    destinationKind: affiliateUrl ? "affiliate" : "canonical",
    monetized: Boolean(affiliateUrl),
    cta: {
      label: affiliateCtaLabel("amazon"),
      sourceKey: "amazon",
      sourceName,
      priceFreshness: "unavailable",
      price: null,
      availability: null,
      disclosure: AFFILIATE_DISCLOSURE,
    },
  };
}

async function getSources(
  client: GrowthAgentDatabaseClient
): Promise<Map<string, SourceAdapterRecord>> {
  const { data, error } = await client
    .from("source_adapters")
    .select(
      "id, source_key, display_name, mode, enabled, credential_status, freshness_ttl_minutes, public_display_allowed, requires_admin_approval, last_health_check_at, last_success_at, last_error_at, last_error_message, created_at, updated_at"
    );
  if (error || !data) return new Map();
  return new Map(
    (data as SourceAdapterRecord[]).map((source) => [source.source_key, source])
  );
}

async function getOffers(
  client: GrowthAgentDatabaseClient,
  laptopId: string,
  offerId?: string
): Promise<ProductOfferRow[]> {
  let query = client
    .from("product_offers")
    .select(PRODUCT_OFFER_SELECT)
    .eq("laptop_id", laptopId);
  if (offerId) query = query.eq("id", offerId);
  const { data, error } = await query
    .order("is_active", { ascending: false })
    .order("source_fetched_at", { ascending: false });
  if (error || !data) return [];
  return data as ProductOfferRow[];
}

async function getOffersForLaptops(
  client: GrowthAgentDatabaseClient,
  laptopIds: string[]
): Promise<ProductOfferRow[]> {
  if (laptopIds.length === 0) return [];
  const chunks: string[][] = [];
  for (let index = 0; index < laptopIds.length; index += 100) {
    chunks.push(laptopIds.slice(index, index + 100));
  }
  const rows = await Promise.all(
    chunks.map(async (ids) => {
      const { data, error } = await client
        .from("product_offers")
        .select(PRODUCT_OFFER_SELECT)
        .in("laptop_id", ids)
        .order("is_active", { ascending: false })
        .order("source_fetched_at", { ascending: false });
      return error || !data ? [] : (data as ProductOfferRow[]);
    })
  );
  return rows.flat();
}

async function getLegacyLaptops(
  client: GrowthAgentDatabaseClient,
  laptopIds: string[]
): Promise<LaptopDestinationRow[]> {
  if (laptopIds.length === 0) return [];
  const chunks: string[][] = [];
  for (let index = 0; index < laptopIds.length; index += 100) {
    chunks.push(laptopIds.slice(index, index + 100));
  }
  const rows = await Promise.all(
    chunks.map(async (ids) => {
      const { data, error } = await client
        .from("laptops")
        .select("id, slug, is_published, asin, amazon_affiliate_url")
        .in("id", ids)
        .eq("is_published", true);
      return error || !data ? [] : (data as LaptopDestinationRow[]);
    })
  );
  return rows.flat();
}

function metadataSafeForPublicDisplay(
  resolved: ResolvedAffiliateDestination,
  source: SourceAdapterRecord | undefined
): AffiliateCtaMetadata {
  if (source?.public_display_allowed) return resolved.cta;
  return {
    ...resolved.cta,
    label: affiliateCtaLabel("other"),
    sourceKey: "other",
    sourceName: "Other retailer",
    priceFreshness: "unavailable",
    price: null,
    availability: null,
  };
}

/**
 * Resolve display-only CTA evidence in bounded bulk queries. Raw destinations
 * never leave this server-only module; callers receive only source labels and
 * fresh-until-bounded price/availability metadata.
 */
export async function getAffiliateCtaMetadataForLaptops(
  laptopIds: readonly string[],
  options: AffiliateResolverOptions = {}
): Promise<Map<string, AffiliateCtaMetadata>> {
  const client = options.client ?? createAdminClient();
  const now = options.now ?? new Date();
  const ids = [...new Set(laptopIds)].filter(Boolean);
  const [settings, sources, offers, laptops] = await Promise.all([
    getAgentSettings(client).catch(() => null),
    getSources(client),
    getOffersForLaptops(client, ids),
    getLegacyLaptops(client, ids),
  ]);
  const affiliateLinksEnabled = monetizationIsEnabled(settings);
  const offersByLaptop = new Map<string, ProductOfferRow[]>();
  for (const offer of offers) {
    if (!offer.laptop_id) continue;
    const grouped = offersByLaptop.get(offer.laptop_id) ?? [];
    grouped.push(offer);
    offersByLaptop.set(offer.laptop_id, grouped);
  }

  const result = new Map<string, AffiliateCtaMetadata>();
  for (const laptop of laptops) {
    let resolved: ResolvedAffiliateDestination | null = null;
    for (const offer of offersByLaptop.get(laptop.id) ?? []) {
      resolved = resolveOfferDestination({
        offer,
        source: sources.get(offer.source_key),
        affiliateLinksEnabled,
        now,
      });
      if (resolved) break;
    }
    resolved ??= resolveLegacyAmazon({
      laptop,
      source: sources.get("amazon"),
      affiliateLinksEnabled,
    });
    if (resolved) {
      result.set(
        laptop.id,
        metadataSafeForPublicDisplay(
          resolved,
          sources.get(resolved.sourceKey)
        )
      );
    }
  }
  return result;
}

/**
 * Resolve only database-owned laptop/offer identifiers. No caller-provided URL
 * is accepted, and every external destination passes a source host allowlist.
 */
export async function resolveAffiliateDestination(
  input: ResolveAffiliateInput,
  options: AffiliateResolverOptions = {}
): Promise<ResolvedAffiliateDestination> {
  const client = options.client ?? createAdminClient();
  const now = options.now ?? new Date();
  const { data: laptop, error } = await client
    .from("laptops")
    .select("id, slug, is_published, asin, amazon_affiliate_url")
    .eq("id", input.laptopId)
    .eq("is_published", true)
    .maybeSingle();
  if (error) {
    throw new AgentError({
      code: "DATABASE_ERROR",
      message: "Could not resolve the product destination.",
      retryable: true,
      cause: error,
    });
  }
  if (!laptop) {
    throw new AgentError({
      code: "NOT_FOUND",
      message: "Published laptop not found.",
    });
  }

  const [settings, sources, offers] = await Promise.all([
    // Missing controls fail closed for monetization while still permitting a
    // policy-clean canonical destination.
    getAgentSettings(client).catch(() => null),
    getSources(client),
    getOffers(client, input.laptopId, input.offerId),
  ]);
  const affiliateLinksEnabled = monetizationIsEnabled(settings);
  if (input.offerId && offers.length === 0) {
    throw new AgentError({
      code: "NOT_FOUND",
      message: "Offer not found for this laptop.",
    });
  }

  for (const offer of offers) {
    const resolved = resolveOfferDestination({
      offer,
      source: sources.get(offer.source_key),
      affiliateLinksEnabled,
      now,
    });
    if (resolved) return resolved;
  }

  // An explicitly selected offer must never silently redirect to a different
  // retailer or to the legacy Amazon fallback.
  if (input.offerId) {
    throw new AgentError({
      code: "AFFILIATE_RESOLUTION_FAILED",
      message: "The selected offer has no policy-compliant destination.",
    });
  }

  const legacy = resolveLegacyAmazon({
    laptop: laptop as LaptopDestinationRow,
    source: sources.get("amazon"),
    affiliateLinksEnabled,
  });
  if (legacy) return legacy;

  throw new AgentError({
    code: "AFFILIATE_RESOLUTION_FAILED",
    message: "No policy-compliant product destination is available.",
  });
}

export { hashDestination };
