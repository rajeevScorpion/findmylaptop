import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { AgentError } from "@/lib/growth-agents/errors";
import type { GrowthAgentDatabaseClient } from "@/lib/growth-agents/types";
import type { DomainId } from "@/lib/domains";
import { auditCatalog } from "./policy";
import { compileProductRulebook } from "./planner";
import {
  compiledRulebookSchema,
  rulebookUpdateSchema,
  scheduleUpdateSchema,
  type CatalogAudit,
  type CatalogCourseSnapshot,
  type CatalogLaptopSnapshot,
  type ProductCurationProposal,
  type ProductCurationRulebook,
  type ProductCurationSchedule,
} from "./types";

const RULEBOOK_SELECT = "id, domain, criteria_text, compiled_json, version, enabled, max_domain_recommendations, max_course_recommendations, rejected_cooldown_days, compiled_at, updated_by, created_at, updated_at";
const SCHEDULE_SELECT = "singleton_key, discovery_enabled, refresh_enabled, paused, run_time, timezone, refresh_interval_hours, max_search_calls_per_run, max_item_calls_per_run, max_requests_per_second, max_daily_requests, refresh_budget_percent, last_discovery_started_at, last_discovery_completed_at, last_refresh_started_at, last_refresh_completed_at, updated_by, created_at, updated_at";
const PROPOSAL_SELECT = "id, agent_job_id, rulebook_id, rulebook_version, domain, proposal_type, laptop_id, course_id, rationale, evidence_json, confidence_score, status, admin_notes, reviewed_by, reviewed_at, created_at, updated_at";
const LAPTOP_SELECT = "id, domain, name, brand, model, asin, cpu, gpu, gpu_vram_gb, ram_gb, storage_gb, display, weight, price_approx, tier, recommended_for_courses, is_published, priority_score, last_checked";

function databaseError(message: string, cause: unknown): AgentError {
  return new AgentError({ code: "DATABASE_ERROR", message, retryable: true, cause });
}

function parseRulebook(row: Record<string, unknown>): ProductCurationRulebook {
  const parsed = compiledRulebookSchema.safeParse(row.compiled_json);
  return {
    ...(row as unknown as ProductCurationRulebook),
    version: Number(row.version),
    max_domain_recommendations: Number(row.max_domain_recommendations),
    max_course_recommendations: Number(row.max_course_recommendations),
    rejected_cooldown_days: Number(row.rejected_cooldown_days),
    compiled_json: parsed.success ? parsed.data : {},
  };
}

function parseSchedule(row: Record<string, unknown>): ProductCurationSchedule {
  return {
    ...(row as unknown as ProductCurationSchedule),
    max_requests_per_second: Number(row.max_requests_per_second),
    refresh_interval_hours: Number(row.refresh_interval_hours),
    max_search_calls_per_run: Number(row.max_search_calls_per_run),
    max_item_calls_per_run: Number(row.max_item_calls_per_run),
    max_daily_requests: Number(row.max_daily_requests),
    refresh_budget_percent: Number(row.refresh_budget_percent),
  };
}

export async function listProductRulebooks(
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<ProductCurationRulebook[]> {
  const { data, error } = await client.from("product_curation_rulebooks").select(RULEBOOK_SELECT).order("domain");
  if (error || !data) throw databaseError("Could not load product curation rulebooks.", error);
  return (data as Record<string, unknown>[]).map(parseRulebook);
}

export async function getProductCurationSchedule(
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<ProductCurationSchedule> {
  const { data, error } = await client.from("product_curation_schedule").select(SCHEDULE_SELECT).eq("singleton_key", true).single();
  if (error || !data) throw databaseError("Could not load product curation schedule.", error);
  return parseSchedule(data as Record<string, unknown>);
}

export async function saveProductRulebook(
  input: unknown,
  actorEmail: string,
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<ProductCurationRulebook> {
  const parsed = rulebookUpdateSchema.parse(input);
  const { data: current, error: currentError } = await client.from("product_curation_rulebooks").select(RULEBOOK_SELECT).eq("domain", parsed.domain).single();
  if (currentError || !current) throw databaseError("Could not load the product rulebook.", currentError);
  const criteriaChanged = current.criteria_text !== parsed.criteriaText;
  const { data, error } = await client
    .from("product_curation_rulebooks")
    .update({
      criteria_text: parsed.criteriaText,
      enabled: criteriaChanged ? false : parsed.enabled,
      max_domain_recommendations: parsed.maxDomainRecommendations,
      max_course_recommendations: parsed.maxCourseRecommendations,
      rejected_cooldown_days: parsed.rejectedCooldownDays,
      ...(criteriaChanged ? { compiled_json: {}, compiled_at: null } : {}),
      updated_by: actorEmail,
    })
    .eq("id", current.id)
    .select(RULEBOOK_SELECT)
    .single();
  if (error || !data) throw databaseError("Could not save the product rulebook.", error);
  return parseRulebook(data as Record<string, unknown>);
}

export async function compileAndActivateRulebook(
  domain: DomainId,
  actorEmail: string,
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<ProductCurationRulebook> {
  const { data: row, error } = await client.from("product_curation_rulebooks").select(RULEBOOK_SELECT).eq("domain", domain).single();
  if (error || !row) throw databaseError("Could not load the product rulebook.", error);
  const rulebook = parseRulebook(row as Record<string, unknown>);
  const { data: courses, error: courseError } = await client.from("courses").select("name").eq("domain", domain).eq("is_active", true).order("sort_order");
  if (courseError || !courses) throw databaseError("Could not load the domain taxonomy.", courseError);
  if (!courses.length) throw new AgentError({ code: "VALIDATION_ERROR", message: "Add at least one active course before compiling this rulebook." });
  const result = await compileProductRulebook({
    domain,
    criteriaText: rulebook.criteria_text,
    courseNames: courses.map((course) => String(course.name)),
    maxCourseRecommendations: rulebook.max_course_recommendations,
  });
  const { data, error: updateError } = await client
    .from("product_curation_rulebooks")
    .update({
      compiled_json: result.compiled,
      version: rulebook.version + 1,
      compiled_at: new Date().toISOString(),
      enabled: true,
      updated_by: actorEmail,
    })
    .eq("id", rulebook.id)
    .eq("version", rulebook.version)
    .select(RULEBOOK_SELECT)
    .maybeSingle();
  if (updateError) throw databaseError("Could not save the compiled rulebook.", updateError);
  if (!data) throw new AgentError({ code: "CONFLICT", message: "The rulebook changed while it was being compiled." });
  const reviewedAt = new Date().toISOString();
  const { error: supersedeError } = await client
    .from("product_curation_proposals")
    .update({ status: "superseded", reviewed_by: actorEmail, reviewed_at: reviewedAt })
    .eq("rulebook_id", rulebook.id)
    .eq("status", "pending")
    .lt("rulebook_version", rulebook.version + 1);
  if (supersedeError) console.error("Could not supersede old product curation proposals", supersedeError.code);
  const { error: staleCandidateError } = await client
    .from("product_candidates")
    .update({ review_status: "stale", reviewed_by: actorEmail, reviewed_at: reviewedAt })
    .eq("target_domain", domain)
    .eq("discovered_by_agent", true)
    .eq("review_status", "pending")
    .lt("rulebook_version", rulebook.version + 1);
  if (staleCandidateError) console.error("Could not mark old-rulebook product candidates stale", staleCandidateError.code);
  await client.from("audit_events").insert({
    event_type: "product_curation.rulebook_compiled",
    actor_type: "admin",
    actor_identifier: actorEmail,
    entity_type: "product_curation_rulebook",
    entity_id: rulebook.id,
    summary: `${domain} product rulebook compiled and enabled.`,
    metadata_json: { domain, version: rulebook.version + 1, response_id: result.responseId, model: result.model, usage: result.usage },
  });
  return parseRulebook(data as Record<string, unknown>);
}

export async function saveProductCurationSchedule(
  input: unknown,
  actorEmail: string,
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<ProductCurationSchedule> {
  const parsed = scheduleUpdateSchema.parse(input);
  try { new Intl.DateTimeFormat("en-US", { timeZone: parsed.timezone }).format(new Date()); }
  catch { throw new AgentError({ code: "VALIDATION_ERROR", message: "Timezone must be a valid IANA timezone." }); }
  const { data, error } = await client
    .from("product_curation_schedule")
    .update({
      discovery_enabled: parsed.discoveryEnabled,
      refresh_enabled: parsed.refreshEnabled,
      paused: parsed.paused,
      run_time: `${parsed.runTime}:00`,
      timezone: parsed.timezone,
      refresh_interval_hours: parsed.refreshIntervalHours,
      max_search_calls_per_run: parsed.maxSearchCallsPerRun,
      max_item_calls_per_run: parsed.maxItemCallsPerRun,
      max_requests_per_second: parsed.maxRequestsPerSecond,
      max_daily_requests: parsed.maxDailyRequests,
      refresh_budget_percent: parsed.refreshBudgetPercent,
      updated_by: actorEmail,
    })
    .eq("singleton_key", true)
    .select(SCHEDULE_SELECT)
    .single();
  if (error || !data) throw databaseError("Could not save the product curation schedule.", error);
  return parseSchedule(data as Record<string, unknown>);
}

export async function auditProductCatalog(
  domain: DomainId,
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<CatalogAudit> {
  const [rulebooks, courseResult, laptopResult, candidateResult] = await Promise.all([
    listProductRulebooks(client),
    client.from("courses").select("id, domain, category, name, workload_level").eq("domain", domain).eq("is_active", true).order("sort_order"),
    client.from("laptops").select(LAPTOP_SELECT).eq("domain", domain).order("priority_score", { ascending: false }),
    client.from("product_candidates").select("id", { count: "exact", head: true }).eq("target_domain", domain).eq("review_status", "pending"),
  ]);
  const rulebook = rulebooks.find((item) => item.domain === domain);
  const compiled = rulebook
    ? compiledRulebookSchema.safeParse(rulebook.compiled_json)
    : null;
  if (!rulebook || !compiled?.success) {
    throw new AgentError({ code: "CONFIGURATION_ERROR", message: `Compile the ${domain} rulebook before auditing its catalog.` });
  }
  if (courseResult.error || !courseResult.data) throw databaseError("Could not load courses for catalog audit.", courseResult.error);
  if (laptopResult.error || !laptopResult.data) throw databaseError("Could not load laptops for catalog audit.", laptopResult.error);
  if (candidateResult.error) throw databaseError("Could not count pending candidates.", candidateResult.error);
  return auditCatalog({
    domain,
    rulebook: compiled.data,
    courses: courseResult.data as CatalogCourseSnapshot[],
    laptops: (laptopResult.data as Record<string, unknown>[]).map((row) => ({ ...row, gpu_vram_gb: row.gpu_vram_gb == null ? null : Number(row.gpu_vram_gb) })) as CatalogLaptopSnapshot[],
    pendingCandidateCount: candidateResult.count ?? 0,
    maxDomainRecommendations: rulebook.max_domain_recommendations,
    maxCourseRecommendations: rulebook.max_course_recommendations,
  });
}

export async function persistCatalogAuditProposals(
  audit: CatalogAudit,
  agentJobId: string | null,
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<number> {
  const rulebook = (await listProductRulebooks(client)).find((item) => item.domain === audit.domain)!;
  const rows = audit.findings.filter((finding) => finding.decision === "add" || finding.decision === "remove" || finding.decision === "review").map((finding) => ({
    agent_job_id: agentJobId,
    rulebook_id: rulebook.id,
    rulebook_version: rulebook.version,
    domain: audit.domain,
    proposal_type: finding.decision === "add" ? "add_course" : finding.decision === "remove" ? "remove_course" : "publication_review",
    laptop_id: finding.laptopId,
    course_id: finding.decision === "review" ? null : finding.courseId,
    rationale: finding.reasons.join(" "),
    evidence_json: { score: finding.score, course_name: finding.courseName },
    confidence_score: finding.score,
  }));
  if (!rows.length) return 0;
  let inserted = 0;
  for (const row of rows) {
    let existingRequest = client
      .from("product_curation_proposals")
      .select("id")
      .eq("proposal_type", row.proposal_type)
      .eq("laptop_id", row.laptop_id)
      .eq("status", "pending");
    existingRequest = row.course_id === null
      ? existingRequest.is("course_id", null)
      : existingRequest.eq("course_id", row.course_id);
    const { data: existing, error: readError } = await existingRequest.maybeSingle();
    if (readError) throw databaseError("Could not check catalog mapping proposals.", readError);
    if (existing) continue;
    const { error } = await client.from("product_curation_proposals").insert(row);
    if (error?.code === "23505") continue;
    if (error) throw databaseError("Could not queue catalog mapping proposals.", error);
    inserted += 1;
  }
  return inserted;
}

export async function listCurationProposals(
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<ProductCurationProposal[]> {
  const { data, error } = await client.from("product_curation_proposals").select(`${PROPOSAL_SELECT}, laptop:laptops(name, slug, is_published), course:courses(name, category)`).eq("status", "pending").order("confidence_score", { ascending: false }).limit(100);
  if (error || !data) throw databaseError("Could not load product curation proposals.", error);
  return (data as Record<string, unknown>[]).map((row) => ({ ...(row as unknown as ProductCurationProposal), confidence_score: Number(row.confidence_score) }));
}

export async function reviewCurationProposal(
  id: string,
  decision: "approve" | "reject",
  actorEmail: string,
  adminNotes: string | null,
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<ProductCurationProposal> {
  const { data: proposal, error } = await client.from("product_curation_proposals").select(PROPOSAL_SELECT).eq("id", id).eq("status", "pending").maybeSingle();
  if (error) throw databaseError("Could not load the curation proposal.", error);
  if (!proposal) throw new AgentError({ code: "CONFLICT", message: "This proposal is no longer pending." });
  if (decision === "approve" && proposal.rulebook_id) {
    const { data: currentRulebook, error: rulebookError } = await client
      .from("product_curation_rulebooks")
      .select("version, enabled")
      .eq("id", proposal.rulebook_id)
      .single();
    if (rulebookError || !currentRulebook) throw databaseError("Could not validate the proposal rulebook.", rulebookError);
    if (!currentRulebook.enabled || Number(currentRulebook.version) !== Number(proposal.rulebook_version)) {
      throw new AgentError({ code: "CONFLICT", message: "This proposal belongs to an inactive or superseded rulebook. Run a new catalog audit." });
    }
  }
  if (decision === "approve" && proposal.course_id) {
    const [{ data: course, error: courseError }, { data: laptop, error: laptopError }] = await Promise.all([
      client.from("courses").select("name, domain, is_active").eq("id", proposal.course_id).single(),
      client.from("laptops").select("id, domain, recommended_for_courses").eq("id", proposal.laptop_id).single(),
    ]);
    if (courseError || !course) throw databaseError("Could not load the proposed course.", courseError);
    if (laptopError || !laptop) throw databaseError("Could not load the proposed laptop.", laptopError);
    if (!course.is_active || course.domain !== laptop.domain || laptop.domain !== proposal.domain) {
      throw new AgentError({ code: "CONFLICT", message: "The course or laptop domain changed; rerun the catalog audit." });
    }
    const current = Array.isArray(laptop.recommended_for_courses) ? laptop.recommended_for_courses.map(String) : [];
    const next = proposal.proposal_type === "add_course"
      ? [...new Set([...current, course.name])]
      : current.filter((name) => name !== course.name);
    const { error: updateError } = await client.from("laptops").update({ recommended_for_courses: next }).eq("id", laptop.id);
    if (updateError) throw databaseError("Could not apply the approved course mapping.", updateError);
  }
  const status = decision === "approve" ? "approved" : "rejected";
  const { data, error: reviewError } = await client.from("product_curation_proposals").update({ status, admin_notes: adminNotes, reviewed_by: actorEmail, reviewed_at: new Date().toISOString() }).eq("id", id).eq("status", "pending").select(PROPOSAL_SELECT).maybeSingle();
  if (reviewError) throw databaseError("Could not review the curation proposal.", reviewError);
  if (!data) throw new AgentError({ code: "CONFLICT", message: "The proposal changed while it was being reviewed." });
  await client.from("audit_events").insert({ event_type: `product_curation.proposal_${status}`, actor_type: "admin", actor_identifier: actorEmail, entity_type: "product_curation_proposal", entity_id: id, summary: `Product curation proposal ${status}.`, metadata_json: { proposal_type: proposal.proposal_type, laptop_id: proposal.laptop_id, course_id: proposal.course_id } });
  return { ...(data as unknown as ProductCurationProposal), confidence_score: Number(data.confidence_score) };
}
