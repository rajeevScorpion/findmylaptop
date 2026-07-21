import "server-only";

import { ZodError } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AgentError,
  isAgentError,
  toAgentError,
} from "@/lib/growth-agents/errors";
import type { GrowthAgentDatabaseClient } from "@/lib/growth-agents/types";
import {
  buildCandidateDedupeKey,
  compareProducts,
  toComparableProduct,
} from "@/lib/sources/deduplication";
import {
  getPriceFreshUntil,
  normalizeProduct,
} from "@/lib/sources/normalization";
import { getSourceAdapter } from "@/lib/sources/registry";
import { isPriceDisplayable } from "@/lib/sources/scoring";
import {
  candidateActionSchema,
  candidateListQuerySchema,
  ingestCandidateSchema,
  normalizedLaptopSchema,
  type CandidateAction,
  type CandidateListQuery,
  type IngestCandidateInput,
  type NormalizedLaptop,
  type ProductCandidateRow,
} from "@/lib/sources/types";

const CANDIDATE_SELECT =
  "id, discovery_job_id, source_key, source_product_id, dedupe_key, raw_payload_json, normalized_json, title, brand, model, price_amount, price_currency, price_fetched_at, product_url, affiliate_url, image_url, source_fetched_at, fresh_until, confidence_score, fit_score, fit_tags, risk_tags, compliance_status, review_status, admin_notes, error_message, reviewed_by, reviewed_at, promoted_laptop_id, created_at, updated_at";

export interface CandidateIngestResult {
  candidate: ProductCandidateRow;
  created: boolean;
}

export interface CandidateServiceOptions {
  client?: GrowthAgentDatabaseClient;
  actorEmail?: string;
}

function databaseError(message: string, cause: unknown): AgentError {
  return new AgentError({
    code: "DATABASE_ERROR",
    message,
    retryable: true,
    cause,
  });
}

function candidateFromRow(row: Record<string, unknown>): ProductCandidateRow {
  return {
    ...(row as unknown as ProductCandidateRow),
    normalized_json: normalizedLaptopSchema.parse(row.normalized_json),
    price_amount:
      row.price_amount === null || row.price_amount === undefined
        ? null
        : Number(row.price_amount),
    confidence_score: Number(row.confidence_score),
    fit_score: Number(row.fit_score),
  };
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  // Strip undefined values and class prototypes before a database write.
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

async function auditIngest(
  client: GrowthAgentDatabaseClient,
  actorEmail: string | undefined,
  candidate: ProductCandidateRow,
  created: boolean
): Promise<void> {
  if (!actorEmail) return;
  const { error } = await client.from("audit_events").insert({
    event_type: "product_candidate.ingested",
    actor_type: "admin",
    actor_identifier: actorEmail,
    entity_type: "product_candidate",
    entity_id: candidate.id,
    summary: created
      ? "Product candidate added to the review queue."
      : "Existing product candidate refreshed.",
    // Deliberately omit title, URLs, normalized data, and raw source payload.
    metadata_json: {
      candidate_id: candidate.id,
      source_key: candidate.source_key,
      source_product_id: candidate.source_product_id,
    },
  });
  if (error) console.error("Product candidate ingest audit failed", error.code);
}

async function assertSourceEnabled(
  sourceKey: string,
  client: GrowthAgentDatabaseClient
): Promise<void> {
  const { data, error } = await client
    .from("source_adapters")
    .select("source_key, enabled")
    .eq("source_key", sourceKey)
    .maybeSingle();

  if (error) throw databaseError("Could not read source enablement.", error);
  if (!data) {
    throw new AgentError({
      code: "CONFIGURATION_ERROR",
      message: "This source is not registered in growth-agent settings.",
      details: { sourceKey },
    });
  }
  if (!data.enabled) {
    throw new AgentError({
      code: "CONFIGURATION_ERROR",
      message: "This source is disabled in growth-agent settings.",
      details: { sourceKey },
    });
  }
}

async function findExistingCandidate(
  normalized: NormalizedLaptop,
  dedupeKey: string,
  client: GrowthAgentDatabaseClient
): Promise<Record<string, unknown> | null> {
  if (normalized.sourceProductId) {
    const { data, error } = await client
      .from("product_candidates")
      .select(CANDIDATE_SELECT)
      .eq("source_key", normalized.sourceKey)
      .eq("source_product_id", normalized.sourceProductId)
      .maybeSingle();
    if (error) throw databaseError("Could not check the candidate source ID.", error);
    if (data) return data as Record<string, unknown>;
  }

  const { data, error } = await client
    .from("product_candidates")
    .select(CANDIDATE_SELECT)
    .eq("source_key", normalized.sourceKey)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (error) throw databaseError("Could not check candidate identity.", error);
  return (data as Record<string, unknown> | null) ?? null;
}

/** Fetch through a registered adapter, normalize, score, and idempotently queue. */
export async function ingestCandidate(
  input: IngestCandidateInput,
  options: CandidateServiceOptions = {}
): Promise<CandidateIngestResult> {
  const client = options.client ?? createAdminClient();
  let parsed: ReturnType<typeof ingestCandidateSchema.parse>;
  try {
    parsed = ingestCandidateSchema.parse(input);
  } catch (error) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: "Candidate import input is invalid.",
      cause: error,
    });
  }

  await assertSourceEnabled(parsed.sourceKey, client);
  const adapter = getSourceAdapter(parsed.sourceKey);

  let sourceProduct;
  try {
    sourceProduct = await adapter.fetchProduct({
      productId: parsed.productId,
      url: parsed.url,
      payload: parsed.payload,
    });
  } catch (error) {
    if (isAgentError(error)) throw error;
    if (error instanceof ZodError || error instanceof TypeError) {
      throw new AgentError({
        code: "VALIDATION_ERROR",
        message: error instanceof Error ? error.message : "Source input is invalid.",
        cause: error,
      });
    }
    throw toAgentError(error, {
      code: "SOURCE_UNAVAILABLE",
      message: `${adapter.displayName} could not return this product.`,
      retryable: true,
    });
  }

  let normalized: NormalizedLaptop;
  try {
    normalized = normalizeProduct(sourceProduct);
  } catch (error) {
    throw new AgentError({
      code: "PRODUCT_NORMALIZATION_FAILED",
      message: "The source product could not be normalized safely.",
      cause: error,
    });
  }

  const dedupeKey = buildCandidateDedupeKey(toComparableProduct(normalized));
  const freshUntil = getPriceFreshUntil(
    normalized.sourceKey,
    normalized.priceFetchedAt
  );
  const values = {
    source_key: normalized.sourceKey,
    source_product_id: normalized.sourceProductId ?? null,
    dedupe_key: dedupeKey,
    raw_payload_json: jsonObject(sourceProduct.rawPayload),
    normalized_json: normalized,
    title: normalized.title,
    brand: normalized.brand ?? null,
    model: normalized.model ?? null,
    price_amount: normalized.price?.amount ?? null,
    price_currency: normalized.price?.currency ?? null,
    price_fetched_at: normalized.priceFetchedAt ?? null,
    product_url: normalized.url,
    affiliate_url: normalized.affiliateUrl ?? null,
    image_url: normalized.imageUrl ?? null,
    source_fetched_at: normalized.fetchedAt,
    fresh_until: freshUntil,
    confidence_score: normalized.confidenceScore,
    fit_score: normalized.fitScore,
    fit_tags: normalized.fitTags,
    risk_tags: normalized.riskTags,
    compliance_status: normalized.complianceStatus,
    error_message: null,
  };

  const existing = await findExistingCandidate(normalized, dedupeKey, client);
  if (existing) {
    const { data, error } = await client
      .from("product_candidates")
      .update(values)
      .eq("id", existing.id as string)
      .select(CANDIDATE_SELECT)
      .single();
    if (error || !data) throw databaseError("Could not refresh the product candidate.", error);
    const candidate = candidateFromRow(data);
    await auditIngest(client, options.actorEmail, candidate, false);
    return { candidate, created: false };
  }

  const { data, error } = await client
    .from("product_candidates")
    .insert(values)
    .select(CANDIDATE_SELECT)
    .single();
  if (error || !data) {
    // A concurrent identical ingest may have won either unique key. Return it.
    if (error?.code === "23505") {
      const concurrent = await findExistingCandidate(normalized, dedupeKey, client);
      if (concurrent) {
        const candidate = candidateFromRow(concurrent);
        await auditIngest(client, options.actorEmail, candidate, false);
        return { candidate, created: false };
      }
    }
    throw databaseError("Could not queue the product candidate.", error);
  }
  const candidate = candidateFromRow(data);
  await auditIngest(client, options.actorEmail, candidate, true);
  return { candidate, created: true };
}

export async function listCandidates(
  query: Partial<CandidateListQuery> = {},
  options: CandidateServiceOptions = {}
): Promise<ProductCandidateRow[]> {
  const client = options.client ?? createAdminClient();
  let parsed: CandidateListQuery;
  try {
    parsed = candidateListQuerySchema.parse(query);
  } catch (error) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: "Candidate list filters are invalid.",
      cause: error,
    });
  }

  let request = client
    .from("product_candidates")
    .select(CANDIDATE_SELECT)
    .order("updated_at", { ascending: false })
    .limit(parsed.limit);
  if (parsed.status) request = request.eq("review_status", parsed.status);
  if (parsed.source) request = request.eq("source_key", parsed.source);
  if (parsed.compliance) request = request.eq("compliance_status", parsed.compliance);

  const { data, error } = await request;
  if (error || !data) throw databaseError("Could not load product candidates.", error);
  return (data as Record<string, unknown>[]).map(candidateFromRow);
}

export async function getCandidate(
  id: string,
  options: CandidateServiceOptions = {}
): Promise<ProductCandidateRow> {
  const client = options.client ?? createAdminClient();
  const { data, error } = await client
    .from("product_candidates")
    .select(CANDIDATE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw databaseError("Could not load the product candidate.", error);
  if (!data) {
    throw new AgentError({ code: "NOT_FOUND", message: "Product candidate not found." });
  }
  return candidateFromRow(data);
}

function promotionIssues(candidate: ProductCandidateRow): string[] {
  const product = candidate.normalized_json;
  const issues: string[] = [];
  if (candidate.compliance_status !== "safe") issues.push("compliance must be safe");
  if (candidate.confidence_score < 50) issues.push("confidence score must be at least 50");
  if (!product.brand && !product.model) issues.push("brand or model is required");
  if (!product.cpu?.label) issues.push("CPU is required");
  if (!product.ramGb) issues.push("RAM capacity is required");
  if (!product.storageGb) issues.push("storage capacity is required");
  if (!product.url) issues.push("product URL is required");
  return issues;
}

function isAmazonProductUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return ["amazon.in", "amazon.com", "amzn.to", "a.co", "amzn.eu", "amzn.asia"].some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "reviewed-laptop";
}

function specLabel(value: { label?: string } | undefined): string | null {
  return value?.label ?? null;
}

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("en-IN")}`;
  }
}

interface ExistingLaptop {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  asin: string | null;
  ram_gb: number | null;
  storage_gb: number | null;
}

async function findExistingLaptop(
  product: NormalizedLaptop,
  client: GrowthAgentDatabaseClient
): Promise<string | null> {
  let request = client
    .from("laptops")
    .select("id, name, brand, model, asin, ram_gb, storage_gb")
    .limit(1_000);
  if (product.sourceKey === "amazon" && product.sourceProductId) {
    const { data, error } = await request.eq("asin", product.sourceProductId);
    if (error) throw databaseError("Could not check the approved catalog.", error);
    if (data?.[0]) return data[0].id as string;
  }

  request = client
    .from("laptops")
    .select("id, name, brand, model, asin, ram_gb, storage_gb")
    .limit(1_000);
  const { data, error } = await request;
  if (error) throw databaseError("Could not check the approved catalog.", error);
  const candidateComparable = toComparableProduct(product);

  for (const row of (data ?? []) as ExistingLaptop[]) {
    const match = compareProducts(candidateComparable, {
      id: row.id,
      sourceKey: "catalog",
      title: row.name,
      brand: row.brand ?? undefined,
      model: row.model ?? undefined,
    });
    if (!match || match.reason !== "same_brand_model") continue;
    if (product.ramGb && row.ram_gb && product.ramGb !== row.ram_gb) continue;
    if (product.storageGb && row.storage_gb && product.storageGb !== row.storage_gb) continue;
    return row.id;
  }
  return null;
}

async function auditReview(
  client: GrowthAgentDatabaseClient,
  eventType: string,
  actor: string,
  candidate: ProductCandidateRow
): Promise<void> {
  const { error } = await client.from("audit_events").insert({
    event_type: eventType,
    actor_type: "admin",
    actor_identifier: actor,
    entity_type: "product_candidate",
    entity_id: candidate.id,
    summary: `Product candidate marked ${candidate.review_status}.`,
    metadata_json: {
      source_key: candidate.source_key,
      review_status: candidate.review_status,
      promoted_laptop_id: candidate.promoted_laptop_id,
    },
  });
  if (error) console.error("Product candidate audit insert failed", error.code);
}

async function saveOffer(
  candidate: ProductCandidateRow,
  laptopId: string,
  client: GrowthAgentDatabaseClient
): Promise<{ id: string; created: boolean }> {
  const product = candidate.normalized_json;
  const showPrice =
    product.price &&
    isPriceDisplayable(product.priceFreshness, product.complianceStatus);
  const values = {
    laptop_id: laptopId,
    candidate_id: candidate.id,
    source_key: candidate.source_key,
    source_product_id: candidate.source_product_id,
    product_url: candidate.product_url,
    affiliate_url: candidate.affiliate_url,
    price_amount: showPrice ? candidate.price_amount : null,
    price_currency: showPrice ? candidate.price_currency : null,
    price_fetched_at: showPrice ? candidate.price_fetched_at : null,
    availability: product.availability ?? null,
    source_fetched_at: candidate.source_fetched_at,
    fresh_until: showPrice ? candidate.fresh_until : null,
    compliance_status: candidate.compliance_status,
    is_active: true,
    raw_payload_json: jsonObject(candidate.raw_payload_json),
  };
  const { data: existing, error: existingError } = await client
    .from("product_offers")
    .select("id")
    .eq("candidate_id", candidate.id)
    .eq("source_key", candidate.source_key)
    .maybeSingle();
  if (existingError) throw databaseError("Could not check the product offer.", existingError);

  if (existing) {
    const { data, error } = await client
      .from("product_offers")
      .update(values)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error || !data) throw databaseError("Could not update the product offer.", error);
    return { id: data.id as string, created: false };
  }

  const { data, error } = await client
    .from("product_offers")
    .insert(values)
    .select("id")
    .single();
  if (error || !data) throw databaseError("Could not create the product offer.", error);
  return { id: data.id as string, created: true };
}

async function markApproved(
  candidate: ProductCandidateRow,
  laptopId: string,
  reviewedBy: string,
  adminNotes: string | null | undefined,
  client: GrowthAgentDatabaseClient
): Promise<ProductCandidateRow> {
  const update: Record<string, unknown> = {
    review_status: "approved",
    promoted_laptop_id: laptopId,
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
    error_message: null,
  };
  if (adminNotes !== undefined) update.admin_notes = adminNotes;

  const { data, error } = await client
    .from("product_candidates")
    .update(update)
    .eq("id", candidate.id)
    .neq("review_status", "approved")
    .select(CANDIDATE_SELECT)
    .maybeSingle();
  if (error) throw databaseError("Could not approve the product candidate.", error);
  if (!data) {
    const current = await getCandidate(candidate.id, { client });
    if (current.review_status === "approved") return current;
    throw new AgentError({
      code: "CONFLICT",
      message: "The candidate changed while it was being approved.",
    });
  }
  return candidateFromRow(data);
}

/** Promote into an unpublished laptop plus offer; publication remains a separate admin review. */
export async function approveCandidate(
  id: string,
  reviewedBy: string,
  adminNotes?: string | null,
  options: CandidateServiceOptions = {}
): Promise<ProductCandidateRow> {
  const client = options.client ?? createAdminClient();
  const candidate = await getCandidate(id, { client });
  if (candidate.review_status === "approved") return candidate;

  const issues = promotionIssues(candidate);
  if (issues.length > 0) {
    throw new AgentError({
      code:
        candidate.compliance_status === "blocked"
          ? "COMPLIANCE_BLOCKED"
          : "ADMIN_APPROVAL_REQUIRED",
      message: `Candidate needs editing before promotion: ${issues.join("; ")}.`,
      details: { issues },
    });
  }

  const product = candidate.normalized_json;
  const existingLaptopId = await findExistingLaptop(product, client);
  let laptopId = existingLaptopId;
  let createdLaptop = false;

  if (!laptopId) {
    const legacyAmazonUrl = [product.affiliateUrl, product.url].find(isAmazonProductUrl);
    if (!legacyAmazonUrl) {
      throw new AgentError({
        code: "ADMIN_APPROVAL_REQUIRED",
        message:
          "This non-Amazon offer must be matched to an existing laptop before promotion because the legacy laptop record still requires an Amazon URL.",
        details: { sourceKey: candidate.source_key, requiresExistingLaptop: true },
      });
    }

    const showPrice =
      product.price &&
      isPriceDisplayable(product.priceFreshness, product.complianceStatus);
    const { data, error } = await client
      .from("laptops")
      .insert({
        slug: `${slugify(`${product.brand ?? ""} ${product.model ?? ""} ${product.title}`)}-${candidate.id.slice(0, 8)}`,
        name: product.title,
        domain: "design",
        brand: product.brand ?? null,
        model: product.model ?? null,
        price_approx: showPrice ? Math.round(product.price!.amount) : null,
        price_label: showPrice
          ? formatPrice(product.price!.amount, product.price!.currency)
          : null,
        amazon_affiliate_url: legacyAmazonUrl,
        asin:
          product.sourceKey === "amazon" && /^[A-Z0-9]{10}$/.test(product.sourceProductId ?? "")
            ? product.sourceProductId
            : null,
        image_url: product.imageUrl ?? null,
        cpu: specLabel(product.cpu),
        gpu: specLabel(product.gpu),
        gpu_vram_gb: product.gpu?.vramGb ?? null,
        ram: product.ramGb
          ? `${product.ramGb} GB${product.ramType ? ` ${product.ramType}` : ""}`
          : null,
        ram_gb: product.ramGb ?? null,
        storage: product.storageGb
          ? `${product.storageGb} GB${product.storageType ? ` ${product.storageType}` : ""}`
          : null,
        storage_gb: product.storageGb ?? null,
        display: specLabel(product.display),
        weight: product.weightKg ? `${product.weightKg} kg` : null,
        os: product.operatingSystem ?? null,
        availability: product.availability ?? null,
        priority_score: 50,
        is_published: false,
        last_checked: product.fetchedAt.slice(0, 10),
        raw_input: `Promoted from reviewed product candidate ${candidate.id}.`,
        created_by: reviewedBy,
      })
      .select("id")
      .single();
    if (error || !data) throw databaseError("Could not create the unpublished laptop.", error);
    laptopId = data.id as string;
    createdLaptop = true;
  }

  let offer: { id: string; created: boolean } | null = null;
  try {
    offer = await saveOffer(candidate, laptopId, client);
    const approved = await markApproved(
      candidate,
      laptopId,
      reviewedBy,
      adminNotes,
      client
    );
    await auditReview(client, "product_candidate.approved", reviewedBy, approved);
    return approved;
  } catch (error) {
    // Best-effort compensation keeps the unpublished catalog free of partial
    // promotions. Existing laptops/offers are never deleted by this path.
    if (offer?.created) {
      await client.from("product_offers").delete().eq("id", offer.id);
    }
    if (createdLaptop && laptopId) {
      await client.from("laptops").delete().eq("id", laptopId);
    }
    throw error;
  }
}

export async function reviewCandidate(
  id: string,
  action: CandidateAction,
  reviewedBy: string,
  options: CandidateServiceOptions = {}
): Promise<ProductCandidateRow> {
  const client = options.client ?? createAdminClient();
  let parsed: CandidateAction;
  try {
    parsed = candidateActionSchema.parse(action);
  } catch (error) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: "Candidate review action is invalid.",
      cause: error,
    });
  }
  if (parsed.action === "approve") {
    return approveCandidate(id, reviewedBy, parsed.adminNotes, { client });
  }

  const current = await getCandidate(id, { client });
  if (current.review_status === "approved") {
    throw new AgentError({
      code: "CONFLICT",
      message: "An approved candidate cannot be changed by the queue action endpoint.",
    });
  }

  // The admin action uses the imperative `reject`, while the persisted state
  // is the past-tense `rejected`. Keep that API wording at the boundary and
  // translate it before writing the constrained database column.
  const reviewStatus = parsed.action === "reject" ? "rejected" : parsed.action;
  const update: Record<string, unknown> = {
    review_status: reviewStatus,
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
  };
  if (parsed.adminNotes !== undefined) update.admin_notes = parsed.adminNotes;
  const { data, error } = await client
    .from("product_candidates")
    .update(update)
    .eq("id", id)
    .neq("review_status", "approved")
    .select(CANDIDATE_SELECT)
    .maybeSingle();
  if (error) throw databaseError("Could not update the candidate review status.", error);
  if (!data) {
    throw new AgentError({
      code: "CONFLICT",
      message: "The candidate changed while it was being reviewed.",
    });
  }
  const reviewed = candidateFromRow(data);
  await auditReview(client, `product_candidate.${reviewStatus}`, reviewedBy, reviewed);
  return reviewed;
}
