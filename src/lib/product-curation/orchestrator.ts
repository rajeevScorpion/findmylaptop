import "server-only";

import { randomUUID } from "node:crypto";
import {
  AmazonApiError,
  buildAffiliateUrl,
  fetchProductByAsin,
  searchAmazonProducts,
  type AmazonProduct,
} from "@/lib/amazon-creators";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgentSettings } from "@/lib/growth-agents/settings";
import {
  claimAgentJob,
  completeAgentJob,
  createAgentJob,
  failAgentJob,
} from "@/lib/growth-agents/jobs";
import { AgentError, toAgentError } from "@/lib/growth-agents/errors";
import type { GrowthAgentDatabaseClient, JsonObject } from "@/lib/growth-agents/types";
import { normalizedLaptopSchema, sourceProductSchema, type SourceProduct } from "@/lib/sources/types";
import { normalizeProduct } from "@/lib/sources/normalization";
import { ingestCandidate } from "@/lib/products/candidates";
import type { DomainId } from "@/lib/domains";
import { evaluateLaptopPolicy, laptopFingerprint, policyForCourse } from "./policy";
import {
  auditProductCatalog,
  getProductCurationSchedule,
  listProductRulebooks,
  persistCatalogAuditProposals,
} from "./service";
import type {
  CatalogLaptopSnapshot,
  ProductCurationRulebook,
  ProductCurationSchedule,
} from "./types";
import { compiledRulebookSchema } from "./types";

const DOMAINS: DomainId[] = ["design", "technology", "management"];

async function assertCurationRuntime(
  client: GrowthAgentDatabaseClient,
  requireResearchAgent: boolean
): Promise<void> {
  const [settings, source] = await Promise.all([
    getAgentSettings(client),
    client.from("source_adapters").select("enabled, credential_status").eq("source_key", "amazon").maybeSingle(),
  ]);
  if (settings.globalPause || settings.emergencyStop) {
    throw new AgentError({ code: "CONFIGURATION_ERROR", message: "Product curation is blocked by the global pause or emergency stop." });
  }
  if (requireResearchAgent && !settings.researchAgentEnabled) {
    throw new AgentError({ code: "CONFIGURATION_ERROR", message: "Enable the Research Agent before running product discovery." });
  }
  if (source.error || !source.data) {
    throw new AgentError({ code: "CONFIGURATION_ERROR", message: "The Amazon source is not registered." });
  }
  if (!source.data.enabled || source.data.credential_status !== "valid") {
    throw new AgentError({ code: "CONFIGURATION_ERROR", message: "Enable Amazon after a successful credential check before running product curation." });
  }
}

function amazonSourceProduct(product: AmazonProduct, fetchedAt = new Date().toISOString()): SourceProduct {
  const affiliateUrl = buildAffiliateUrl(product.asin);
  const url = new URL(affiliateUrl);
  url.search = "";
  return sourceProductSchema.parse({
    sourceKey: "amazon",
    sourceProductId: product.asin,
    title: product.title,
    url: url.toString(),
    affiliateUrl,
    brand: product.brand,
    price: product.priceAmount === undefined ? undefined : { amount: product.priceAmount, currency: "INR" },
    priceFetchedAt: product.priceAmount === undefined ? undefined : fetchedAt,
    availability: product.availability,
    imageUrl: product.imageUrl,
    fetchedAt,
    features: product.features,
    rawPayload: { asin: product.asin, title: product.title, brand: product.brand, availability: product.availability, features: product.features },
  });
}

function asLaptopSnapshot(source: SourceProduct): CatalogLaptopSnapshot {
  const product = normalizeProduct(source);
  return {
    id: product.sourceProductId ?? product.title,
    domain: "design",
    name: product.title,
    brand: product.brand ?? null,
    model: product.model ?? null,
    asin: product.sourceProductId ?? null,
    cpu: product.cpu?.label ?? null,
    gpu: product.gpu?.label ?? null,
    gpu_vram_gb: product.gpu?.vramGb ?? null,
    ram_gb: product.ramGb ?? null,
    storage_gb: product.storageGb ?? null,
    display: product.display?.label ?? null,
    weight: product.weightKg ? `${product.weightKg} kg` : null,
    price_approx: product.price?.amount ?? null,
    tier: null,
    recommended_for_courses: [],
    is_published: false,
    priority_score: product.fitScore,
    last_checked: product.fetchedAt.slice(0, 10),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function claimAmazonCall(
  schedule: ProductCurationSchedule,
  client: GrowthAgentDatabaseClient
): Promise<void> {
  const intervalMs = Math.ceil(1000 / schedule.max_requests_per_second);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await client.rpc("claim_source_api_budget", {
      p_source_key: "amazon",
      p_daily_limit: schedule.max_daily_requests,
      p_min_interval_ms: intervalMs,
      p_now: new Date().toISOString(),
    });
    if (error) throw new AgentError({ code: "DATABASE_ERROR", message: "Could not claim the Amazon API budget.", retryable: true, cause: error });
    if (data === true) return;
    if (attempt === 0) await delay(intervalMs + 50);
  }
  throw new AgentError({ code: "SOURCE_RATE_LIMITED", message: "The configured Amazon API budget or request interval has been reached.", retryable: true });
}

async function knownCandidateIdentities(
  cooldownDays: number,
  rulebookVersion: number,
  client: GrowthAgentDatabaseClient
): Promise<{ asins: Set<string>; fingerprints: Set<string> }> {
  const { data, error } = await client.from("product_candidates").select("source_product_id, review_status, reviewed_at, rulebook_version, normalized_json").eq("source_key", "amazon");
  if (error || !data) throw new AgentError({ code: "DATABASE_ERROR", message: "Could not load existing Amazon candidates.", retryable: true, cause: error });
  const cutoff = Date.now() - cooldownDays * 86_400_000;
  const asins = new Set<string>();
  const fingerprints = new Set<string>();
  for (const row of data) {
    if (row.review_status === "rejected" && row.reviewed_at && new Date(row.reviewed_at).getTime() < cutoff) continue;
    if (row.review_status === "stale" && Number(row.rulebook_version) !== rulebookVersion) continue;
    if (row.source_product_id) asins.add(String(row.source_product_id).toUpperCase());
    const parsed = normalizedLaptopSchema.safeParse(row.normalized_json);
    if (!parsed.success) continue;
    fingerprints.add(laptopFingerprint({
      id: String(row.source_product_id ?? parsed.data.title), domain: "design", name: parsed.data.title,
      brand: parsed.data.brand ?? null, model: parsed.data.model ?? null, asin: parsed.data.sourceProductId ?? null,
      cpu: parsed.data.cpu?.label ?? null, gpu: parsed.data.gpu?.label ?? null, gpu_vram_gb: parsed.data.gpu?.vramGb ?? null,
      ram_gb: parsed.data.ramGb ?? null, storage_gb: parsed.data.storageGb ?? null, display: parsed.data.display?.label ?? null,
      weight: parsed.data.weightKg ? `${parsed.data.weightKg} kg` : null, price_approx: parsed.data.price?.amount ?? null,
      tier: null, recommended_for_courses: [], is_published: false, priority_score: parsed.data.fitScore,
      last_checked: parsed.data.fetchedAt.slice(0, 10),
    }));
  }
  return { asins, fingerprints };
}

async function discoverDomain(input: {
  domain: DomainId;
  jobId: string;
  schedule: ProductCurationSchedule;
  rulebook: ProductCurationRulebook;
  client: GrowthAgentDatabaseClient;
  searchCallLimit: number;
}) {
  const audit = await auditProductCatalog(input.domain, input.client);
  const proposals = await persistCatalogAuditProposals(audit, input.jobId, input.client);
  const compiled = compiledRulebookSchema.safeParse(input.rulebook.compiled_json);
  if (!audit.searchAllowed || !compiled.success) {
    return { domain: input.domain, audit, proposals, searches: 0, queued: 0, skippedDuplicates: 0 };
  }
  const gapNames = new Set(audit.gaps.filter((gap) => gap.missingCount > 0).map((gap) => gap.courseName));
  const strategies = compiled.data.searchStrategies
    .map((strategy) => ({ ...strategy, courseNames: strategy.courseNames.filter((name) => gapNames.has(name)) }))
    .filter((strategy) => strategy.courseNames.length > 0)
    .slice(0, input.searchCallLimit);
  const candidateIdentities = await knownCandidateIdentities(input.rulebook.rejected_cooldown_days, input.rulebook.version, input.client);
  const knownAsins = new Set([...audit.knownAsins, ...candidateIdentities.asins]);
  const knownFingerprints = new Set([...audit.knownFingerprints, ...candidateIdentities.fingerprints]);
  const shortlist: Array<{ product: AmazonProduct; source: SourceProduct; strategy: typeof strategies[number]; score: number }> = [];
  let searches = 0;
  let skippedDuplicates = 0;
  for (const strategy of strategies) {
    await claimAmazonCall(input.schedule, input.client);
    searches += 1;
    const results = await searchAmazonProducts({ keywords: strategy.keywords, itemCount: 10 });
    for (const product of results) {
      if (knownAsins.has(product.asin)) { skippedDuplicates += 1; continue; }
      const source = amazonSourceProduct(product);
      const snapshot = { ...asLaptopSnapshot(source), domain: input.domain };
      const fingerprint = laptopFingerprint(snapshot);
      if (knownFingerprints.has(fingerprint)) { skippedDuplicates += 1; continue; }
      const evaluations = strategy.courseNames.map((course) =>
        evaluateLaptopPolicy(snapshot, policyForCourse(compiled.data, course))
      );
      if (!evaluations.length || evaluations.some((evaluation) => !evaluation.pass)) continue;
      const normalizedProduct = normalizeProduct(source);
      const policyScore = Math.min(...evaluations.map((evaluation) => evaluation.score));
      const score = Math.round(policyScore * 0.6 + normalizedProduct.confidenceScore * 0.25 + normalizedProduct.fitScore * 0.15);
      shortlist.push({ product, source, strategy, score });
      knownAsins.add(product.asin);
      knownFingerprints.add(fingerprint);
    }
  }
  const capacity = Math.max(0, Math.min(3 - audit.pendingCandidateCount, input.rulebook.max_domain_recommendations - audit.publishedCount));
  const selected = shortlist.sort((left, right) => right.score - left.score).slice(0, capacity);
  let queued = 0;
  for (const item of selected) {
    const result = await ingestCandidate(
      { sourceKey: "amazon", targetDomain: input.domain, productId: item.product.asin },
      {
        client: input.client,
        sourceProductOverride: item.source,
        curation: {
          discoveryJobId: input.jobId,
          targetDomain: input.domain,
          suggestedCourseNames: item.strategy.courseNames,
          rulebookVersion: input.rulebook.version,
          portfolioRole: item.strategy.portfolioRole,
          gapReason: item.strategy.rationale,
          curationScore: item.score,
          reopenReviewedCandidate: true,
        },
      }
    );
    if (result.created) queued += 1;
  }
  return { domain: input.domain, audit, proposals, searches, queued, skippedDuplicates };
}

function errorForJob(error: unknown) {
  const parsed = toAgentError(error, { code: "SOURCE_UNAVAILABLE", message: "The autonomous product curation run failed.", retryable: true });
  return { code: parsed.code, message: parsed.message, retryable: parsed.retryable || parsed.code === "SOURCE_RATE_LIMITED" };
}

export async function runProductDiscovery(input: {
  actorEmail?: string;
  now?: Date;
  client?: GrowthAgentDatabaseClient;
  manual?: boolean;
} = {}) {
  const client = input.client ?? createAdminClient();
  const now = input.now ?? new Date();
  await assertCurationRuntime(client, true);
  const schedule = await getProductCurationSchedule(client);
  const key = input.manual ? `manual:${randomUUID()}` : now.toISOString().slice(0, 10);
  const { job } = await createAgentJob({ jobType: "research.discover_laptops", idempotencyKey: `product-discovery:${key}`, maxAttempts: 3, createdBy: input.actorEmail ?? null }, client);
  const claimed = await claimAgentJob(job.id, `product-curation:${process.env.VERCEL_REGION ?? "local"}`, { lockTtlSeconds: 300, now }, client);
  if (!claimed?.lock_token) return { job, claimed: false, domains: [] };
  await client.from("product_curation_schedule").update({ last_discovery_started_at: now.toISOString() }).eq("singleton_key", true);
  try {
    const rulebooks = await listProductRulebooks(client);
    const domains = [];
    let remainingSearchCalls = schedule.max_search_calls_per_run;
    for (const domain of DOMAINS) {
      const rulebook = rulebooks.find((item) => item.domain === domain);
      if (!rulebook?.enabled || !("summary" in rulebook.compiled_json)) continue;
      const result = await discoverDomain({ domain, jobId: claimed.id, schedule, rulebook, client, searchCallLimit: remainingSearchCalls });
      domains.push(result);
      remainingSearchCalls = Math.max(0, remainingSearchCalls - result.searches);
    }
    const completedAt = new Date().toISOString();
    await client.from("product_curation_schedule").update({ last_discovery_completed_at: completedAt }).eq("singleton_key", true);
    const result = { domains: domains.map(({ domain, proposals, searches, queued, skippedDuplicates, audit }) => ({ domain, proposals, searches, queued, skippedDuplicates, searchReason: audit.searchReason })) } as unknown as JsonObject;
    const completed = await completeAgentJob(claimed.id, claimed.lock_token, result, client);
    return { job: completed, claimed: true, domains };
  } catch (error) {
    const failure = errorForJob(error);
    await failAgentJob(claimed.id, claimed.lock_token, { ...failure, retryAt: new Date(Date.now() + 15 * 60_000).toISOString() }, client);
    throw error;
  }
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export async function runProductRefresh(input: {
  actorEmail?: string;
  now?: Date;
  client?: GrowthAgentDatabaseClient;
  manual?: boolean;
} = {}) {
  const client = input.client ?? createAdminClient();
  const now = input.now ?? new Date();
  await assertCurationRuntime(client, false);
  const schedule = await getProductCurationSchedule(client);
  const key = input.manual ? `manual:${randomUUID()}` : now.toISOString().slice(0, 10);
  const { job } = await createAgentJob({ jobType: "research.refresh_product_data", idempotencyKey: `product-refresh:${key}`, maxAttempts: 3, createdBy: input.actorEmail ?? null }, client);
  const claimed = await claimAgentJob(job.id, `product-refresh:${process.env.VERCEL_REGION ?? "local"}`, { lockTtlSeconds: 300, now }, client);
  if (!claimed?.lock_token) return { job, claimed: false, refreshed: 0, failed: 0 };
  await client.from("product_curation_schedule").update({ last_refresh_started_at: now.toISOString() }).eq("singleton_key", true);
  try {
    const cutoff = new Date(now.getTime() - schedule.refresh_interval_hours * 3_600_000).toISOString().slice(0, 10);
    const refreshLimit = Math.max(1, Math.floor(schedule.max_item_calls_per_run * schedule.refresh_budget_percent / 100));
    const { data, error } = await client.from("laptops").select("id, asin, last_checked").not("asin", "is", null).or(`last_checked.is.null,last_checked.lte.${cutoff}`).order("last_checked", { ascending: true, nullsFirst: true }).limit(refreshLimit);
    if (error || !data) throw new AgentError({ code: "DATABASE_ERROR", message: "Could not load laptops due for refresh.", retryable: true, cause: error });
    let refreshed = 0;
    let failed = 0;
    const deadline = Date.now() + 50_000;
    for (const laptop of data) {
      if (Date.now() >= deadline) break;
      try {
        await claimAmazonCall(schedule, client);
        const product = await fetchProductByAsin(String(laptop.asin));
        const fetchedAt = new Date().toISOString();
        const { error: updateError } = await client.from("laptops").update({
          price_approx: product.priceAmount ?? null,
          price_label: product.priceAmount === undefined ? null : formatInr(product.priceAmount),
          image_url: product.imageUrl ?? null,
          last_checked: fetchedAt.slice(0, 10),
        }).eq("id", laptop.id);
        if (updateError) throw updateError;
        const { error: offerError } = await client.from("product_offers").update({
          price_amount: product.priceAmount ?? null,
          price_currency: product.priceAmount === undefined ? null : "INR",
          price_fetched_at: product.priceAmount === undefined ? null : fetchedAt,
          availability: product.availability ?? null,
          source_fetched_at: fetchedAt,
          fresh_until: product.priceAmount === undefined ? null : new Date(new Date(fetchedAt).getTime() + 22 * 3_600_000).toISOString(),
        }).eq("laptop_id", laptop.id).eq("source_key", "amazon");
        if (offerError) throw offerError;
        refreshed += 1;
      } catch (error) {
        failed += 1;
        if (error instanceof AmazonApiError && error.status === 429) break;
      }
    }
    const completedAt = new Date().toISOString();
    await client.from("product_curation_schedule").update({ last_refresh_completed_at: completedAt }).eq("singleton_key", true);
    const completed = await completeAgentJob(claimed.id, claimed.lock_token, { refreshed, failed } as unknown as JsonObject, client);
    return { job: completed, claimed: true, refreshed, failed };
  } catch (error) {
    const failure = errorForJob(error);
    await failAgentJob(claimed.id, claimed.lock_token, { ...failure, retryAt: new Date(Date.now() + 15 * 60_000).toISOString() }, client);
    throw error;
  }
}

function localParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export async function pollProductCuration(input: { now?: Date; client?: GrowthAgentDatabaseClient } = {}) {
  const client = input.client ?? createAdminClient();
  const now = input.now ?? new Date();
  const [settings, schedule] = await Promise.all([getAgentSettings(client), getProductCurationSchedule(client)]);
  if (settings.globalPause || settings.emergencyStop || !settings.researchAgentEnabled || schedule.paused) {
    return { skipped: true, reason: "Product curation is disabled or paused.", discovery: null, refresh: null };
  }
  const localNow = localParts(now, schedule.timezone);
  const lastDiscoveryDate = schedule.last_discovery_completed_at ? localParts(new Date(schedule.last_discovery_completed_at), schedule.timezone).date : null;
  const discoveryDue = schedule.discovery_enabled && localNow.time >= schedule.run_time.slice(0, 5) && lastDiscoveryDate !== localNow.date;
  const refreshDue = schedule.refresh_enabled && (!schedule.last_refresh_completed_at || now.getTime() - new Date(schedule.last_refresh_completed_at).getTime() >= schedule.refresh_interval_hours * 3_600_000);
  const refresh = refreshDue ? await runProductRefresh({ now, client }) : null;
  const discovery = discoveryDue ? await runProductDiscovery({ now, client }) : null;
  return { skipped: false, discovery, refresh };
}
