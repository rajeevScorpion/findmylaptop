import "server-only";
import OpenAI from "openai";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGrowthAgentModel } from "@/lib/growth-agents/models";
import type { BlogPost } from "@/lib/blog/types";
import type {
  BlogAuthorPersona,
  PersonaAffiliatePolicy,
  PersonaOption,
  PersonaPermissions,
  PersonaPreviewResult,
  PersonaPublicSnapshot,
  PersonaSelection,
  PersonaStatus,
  PersonaToneSettings,
  PersonaUsage,
} from "./types";
import { hasTransparentPersonaDisclosure } from "./schemas";
import type { PersonaInput, PersonaSelectionInput, PersonaUpdate } from "./schemas";

interface PersonaRow {
  id: string;
  slug: string;
  display_name: string;
  public_role: string;
  short_bio: string;
  long_internal_description: string | null;
  author_type: BlogAuthorPersona["authorType"];
  status: PersonaStatus;
  version: number;
  avatar_url: string | null;
  expertise_tags: string[] | null;
  target_audience_tags: string[] | null;
  topic_category_tags: string[] | null;
  software_workflow_tags: string[] | null;
  tone_settings_json: PersonaToneSettings | null;
  buying_philosophy: string | null;
  writing_dos_json: string[] | null;
  writing_donts_json: string[] | null;
  persona_system_prompt: string;
  affiliate_policy_json: PersonaAffiliatePolicy | null;
  permissions_json: PersonaPermissions | null;
  disclosure_text: string;
  priority_weight: number | string;
  is_default_fallback: boolean;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_TONE: PersonaToneSettings = {
  formality: "friendly",
  depth: "intermediate",
  reassuranceLevel: "medium",
  technicalDensity: "medium",
};

const DEFAULT_AFFILIATE: PersonaAffiliatePolicy = {
  allowAffiliateLinks: false,
  maxProductCards: 0,
  requiredDisclosureText: "",
};

const DEFAULT_PERMISSIONS: PersonaPermissions = {
  canWriteBlogs: true,
  canWriteComparisons: false,
  canInsertProductCards: false,
  canBeAutoScheduled: false,
  alwaysRequiresManualReview: true,
};

function safeAvatarUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function mapPersona(row: PersonaRow): BlogAuthorPersona {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    publicRole: row.public_role,
    shortBio: row.short_bio,
    longInternalDescription: row.long_internal_description,
    authorType: row.author_type,
    status: row.status,
    version: row.version,
    avatarUrl: safeAvatarUrl(row.avatar_url),
    expertiseTags: row.expertise_tags ?? [],
    targetAudienceTags: row.target_audience_tags ?? [],
    topicCategoryTags: row.topic_category_tags ?? [],
    softwareWorkflowTags: row.software_workflow_tags ?? [],
    toneSettings: row.tone_settings_json ?? DEFAULT_TONE,
    buyingPhilosophy: row.buying_philosophy ?? "",
    writingDos: row.writing_dos_json ?? [],
    writingDonts: row.writing_donts_json ?? [],
    personaSystemPrompt: row.persona_system_prompt,
    affiliatePolicy: row.affiliate_policy_json ?? DEFAULT_AFFILIATE,
    permissions: row.permissions_json ?? DEFAULT_PERMISSIONS,
    disclosureText: row.disclosure_text,
    priorityWeight: Number(row.priority_weight ?? 1),
    isDefaultFallback: row.is_default_fallback,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDbInput(input: PersonaInput | PersonaUpdate, actorEmail: string) {
  const row: Record<string, unknown> = { updated_by: actorEmail };
  const put = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };
  put("slug", input.slug);
  put("display_name", input.displayName);
  put("public_role", input.publicRole);
  put("short_bio", input.shortBio);
  put("long_internal_description", input.longInternalDescription);
  put("author_type", input.authorType);
  put("status", input.status);
  put("avatar_url", input.avatarUrl);
  put("expertise_tags", input.expertiseTags);
  put("target_audience_tags", input.targetAudienceTags);
  put("topic_category_tags", input.topicCategoryTags);
  put("software_workflow_tags", input.softwareWorkflowTags);
  put("tone_settings_json", input.toneSettings);
  put("buying_philosophy", input.buyingPhilosophy);
  put("writing_dos_json", input.writingDos);
  put("writing_donts_json", input.writingDonts);
  put("persona_system_prompt", input.personaSystemPrompt);
  put("affiliate_policy_json", input.affiliatePolicy);
  put("permissions_json", input.permissions);
  put("disclosure_text", input.disclosureText);
  put("priority_weight", input.priorityWeight);
  put("is_default_fallback", input.isDefaultFallback);
  return row;
}

export function buildPersonaPublicSnapshot(persona: BlogAuthorPersona): PersonaPublicSnapshot {
  return {
    id: persona.id,
    slug: persona.slug,
    displayName: persona.displayName,
    publicRole: persona.publicRole,
    shortBio: persona.shortBio,
    authorType: persona.authorType,
    version: persona.version,
    avatarUrl: persona.avatarUrl,
    expertiseTags: persona.expertiseTags,
    disclosureText: persona.disclosureText,
  };
}

export function toPersonaOption(persona: BlogAuthorPersona): PersonaOption {
  return {
    ...buildPersonaPublicSnapshot(persona),
    status: persona.status,
    permissions: persona.permissions,
  };
}

async function logAudit(
  personaId: string | null,
  eventType: string,
  actorEmail: string | null,
  metadata: Record<string, unknown> = {}
) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("blog_persona_audit_logs").insert({
    persona_id: personaId,
    event_type: eventType,
    actor_email: actorEmail,
    metadata_json: metadata,
  });
  if (error) console.error("[personas] audit insert failed", error.code);
}

export async function listPersonas(options?: {
  includeSoftDeleted?: boolean;
  activeOnly?: boolean;
}): Promise<BlogAuthorPersona[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("blog_author_personas")
    .select("*")
    .order("is_default_fallback", { ascending: false })
    .order("priority_weight", { ascending: false })
    .order("display_name", { ascending: true });
  if (options?.activeOnly) query = query.eq("status", "active");
  else if (!options?.includeSoftDeleted) query = query.neq("status", "soft_deleted");
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as PersonaRow[]).map(mapPersona);
}

export async function getPersonaOptionsForAdmin(): Promise<PersonaOption[]> {
  return (await listPersonas()).map(toPersonaOption);
}

export async function getPersonaById(id: string): Promise<BlogAuthorPersona | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("blog_author_personas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPersona(data as PersonaRow) : null;
}

interface PersonaUsageRow {
  author_persona_id: string | null;
  status: string;
  updated_at: string;
}

function summarizePersonaUsage(rows: PersonaUsageRow[]): Map<string, PersonaUsage> {
  const usage = new Map<string, PersonaUsage>();
  for (const row of rows) {
    if (!row.author_persona_id) continue;
    const current = usage.get(row.author_persona_id) ?? {
      totalPosts: 0,
      draftCount: 0,
      publishedCount: 0,
      lastUsedAt: null,
    };
    current.totalPosts += 1;
    if (["draft", "ai_generated", "review"].includes(row.status)) {
      current.draftCount += 1;
    }
    if (row.status === "published") current.publishedCount += 1;
    if (!current.lastUsedAt || row.updated_at > current.lastUsedAt) {
      current.lastUsedAt = row.updated_at;
    }
    usage.set(row.author_persona_id, current);
  }
  return usage;
}

const EMPTY_USAGE: PersonaUsage = {
  totalPosts: 0,
  draftCount: 0,
  publishedCount: 0,
  lastUsedAt: null,
};

export async function getPersonaUsage(personaId: string): Promise<PersonaUsage> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("author_persona_id, status, updated_at")
    .eq("author_persona_id", personaId);
  if (error) throw new Error(error.message);
  return summarizePersonaUsage((data ?? []) as PersonaUsageRow[]).get(personaId) ?? {
    ...EMPTY_USAGE,
  };
}

export async function listPersonasWithUsage(options?: {
  includeSoftDeleted?: boolean;
  activeOnly?: boolean;
}): Promise<{ persona: BlogAuthorPersona; usage: PersonaUsage }[]> {
  const [personas, usageRows] = await Promise.all([
    listPersonas(options),
    (async () => {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("blog_posts")
        .select("author_persona_id, status, updated_at")
        .not("author_persona_id", "is", null);
      if (error) throw new Error(error.message);
      return (data ?? []) as PersonaUsageRow[];
    })(),
  ]);
  const usage = summarizePersonaUsage(usageRows);
  return personas.map((persona) => ({
    persona,
    usage: usage.get(persona.id) ?? { ...EMPTY_USAGE },
  }));
}

export async function createPersona(input: PersonaInput, actorEmail: string) {
  if (!hasTransparentPersonaDisclosure(input.authorType, input.disclosureText)) {
    throw new Error("Editorial and brand personas require a transparent public disclosure.");
  }
  const supabase = createAdminClient();
  if (input.isDefaultFallback) {
    const { data: replacedFallbacks, error } = await supabase
      .from("blog_author_personas")
      .update({ is_default_fallback: false, updated_by: actorEmail })
      .eq("is_default_fallback", true)
      .select("id, version");
    if (error) throw new Error(error.message);
    for (const fallback of replacedFallbacks ?? []) {
      await logAudit(fallback.id, "persona.updated", actorEmail, {
        reason: "default_fallback_reassigned",
        isDefaultFallback: false,
        version: fallback.version,
      });
    }
  }
  const { data, error } = await supabase
    .from("blog_author_personas")
    .insert({ ...toDbInput(input, actorEmail), created_by: actorEmail })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const persona = mapPersona(data as PersonaRow);
  await logAudit(persona.id, "persona.created", actorEmail, {
    slug: persona.slug,
    version: persona.version,
  });
  return persona;
}

function statusEvent(previous: PersonaStatus, next: PersonaStatus): string {
  if (next === "active" && previous !== "active") return "persona.enabled";
  if (next === "disabled") return "persona.disabled";
  if (next === "archived") return "persona.archived";
  if (next === "soft_deleted") return "persona.soft_deleted";
  if (previous === "soft_deleted") return "persona.restored";
  return "persona.updated";
}

export async function updatePersona(id: string, patch: PersonaUpdate, actorEmail: string) {
  const existing = await getPersonaById(id);
  if (!existing) return null;
  if (patch.slug && patch.slug !== existing.slug) {
    const usage = await getPersonaUsage(id);
    if (usage.totalPosts > 0) {
      throw new Error(
        "Persona slugs cannot change after a draft or published post stores that attribution."
      );
    }
  }
  if (
    !hasTransparentPersonaDisclosure(
      patch.authorType ?? existing.authorType,
      patch.disclosureText ?? existing.disclosureText
    )
  ) {
    throw new Error("Editorial and brand personas require a transparent public disclosure.");
  }
  const supabase = createAdminClient();
  if (patch.isDefaultFallback) {
    const { data: replacedFallbacks, error } = await supabase
      .from("blog_author_personas")
      .update({ is_default_fallback: false, updated_by: actorEmail })
      .eq("is_default_fallback", true)
      .neq("id", id)
      .select("id, version");
    if (error) throw new Error(error.message);
    for (const fallback of replacedFallbacks ?? []) {
      await logAudit(fallback.id, "persona.updated", actorEmail, {
        reason: "default_fallback_reassigned",
        isDefaultFallback: false,
        version: fallback.version,
      });
    }
  }
  const dbPatch = toDbInput(patch, actorEmail);
  if (patch.status === "archived") dbPatch.archived_at = new Date().toISOString();
  else if (patch.status && existing.status === "archived") dbPatch.archived_at = null;
  if (patch.status === "soft_deleted") dbPatch.deleted_at = new Date().toISOString();
  else if (patch.status && existing.status === "soft_deleted") dbPatch.deleted_at = null;

  const { data, error } = await supabase
    .from("blog_author_personas")
    .update(dbPatch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const persona = mapPersona(data as PersonaRow);
  await logAudit(id, statusEvent(existing.status, persona.status), actorEmail, {
    previousStatus: existing.status,
    status: persona.status,
    version: persona.version,
  });
  return persona;
}

export async function applyPersonaAction(
  id: string,
  action: "disable" | "archive" | "soft_delete" | "restore" | "hard_delete",
  actorEmail: string
) {
  const persona = await getPersonaById(id);
  if (!persona) return { persona: null, deleted: false };
  if (action !== "hard_delete") {
    const status: PersonaStatus =
      action === "disable"
        ? "disabled"
        : action === "archive"
          ? "archived"
          : action === "soft_delete"
            ? "soft_deleted"
            : "draft";
    return { persona: await updatePersona(id, { status }, actorEmail), deleted: false };
  }

  const supabase = createAdminClient();
  const { count, error: countError } = await supabase
    .from("blog_posts")
    .select("id", { count: "exact", head: true })
    .eq("author_persona_id", id);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) > 0) {
    throw new Error("Hard delete is blocked while posts or drafts use this persona.");
  }
  await logAudit(id, "persona.hard_deleted", actorEmail, {
    slug: persona.slug,
    version: persona.version,
  });
  const { error } = await supabase.from("blog_author_personas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { persona: null, deleted: true };
}

function normalizedTerms(values: string[]): string[] {
  return values
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9+#.]+/))
    .filter((value) => value.length > 1);
}

function countMatches(haystack: string, terms: string[]): number {
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

export async function selectPersonaForTopic(
  input: PersonaSelectionInput
): Promise<PersonaSelection | null> {
  const personas = (await listPersonas({ activeOnly: true })).filter(
    (persona) => persona.permissions.canWriteBlogs
  );
  if (personas.length === 0) return null;
  const topic = [
    input.topic,
    input.topicCategory ?? "",
    ...(input.targetAudience ?? []),
    ...(input.softwareWorkflows ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const ranked = personas
    .map((persona) => {
      const expertise = countMatches(topic, normalizedTerms(persona.expertiseTags));
      const workflows = countMatches(topic, normalizedTerms(persona.softwareWorkflowTags));
      const categories = countMatches(topic, normalizedTerms(persona.topicCategoryTags));
      const audiences = countMatches(topic, normalizedTerms(persona.targetAudienceTags));
      const semanticScore = expertise * 4 + workflows * 5 + categories * 3 + audiences * 2;
      const score = semanticScore + Math.min(persona.priorityWeight, 10) / 10;
      return { persona, score, semanticScore };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (best.semanticScore === 0) {
    const fallback = personas.find((persona) => persona.isDefaultFallback) ?? best.persona;
    return {
      persona: fallback,
      score: 0,
      reason: "No specialist matched strongly, so the default editorial persona was selected.",
    };
  }
  return {
    persona: best.persona,
    score: best.score,
    reason: `Selected for matching expertise, audience, or software tags for “${input.topic}”.`,
  };
}

function deterministicPreview(persona: BlogAuthorPersona, topic: string): string {
  const expertise = persona.expertiseTags.slice(0, 3).join(", ");
  const angle = persona.buyingPhilosophy || "Start with the real workload and explain each trade-off.";
  return `${topic} is easiest to understand when we begin with the work the laptop must handle, not a list of impressive specifications. ${angle}${
    expertise ? ` I would frame the guide around ${expertise}, then turn those needs into a short, verifiable buying checklist.` : ""
  }`;
}

export async function previewPersona(
  persona: BlogAuthorPersona,
  topic: string,
  actorEmail: string
): Promise<PersonaPreviewResult> {
  const model = getGrowthAgentModel("writer");
  let result: PersonaPreviewResult = {
    text: deterministicPreview(persona, topic),
    usedAi: false,
    model: null,
  };
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.responses.create({
        model,
        store: false,
        max_output_tokens: 260,
        input: [
          {
            role: "system",
            content:
              "Write one short sample opening paragraph for an admin preview. Never invent product facts, prices, credentials, personal experience, or test results. The persona is editorial guidance, not a real person. Return plain text only.",
          },
          {
            role: "user",
            content: `Topic: ${topic}\nPublic role: ${persona.publicRole}\nDisclosure: ${persona.disclosureText}\nBuying philosophy: ${persona.buyingPhilosophy}\nWriting guidance: ${persona.personaSystemPrompt}\nDo: ${persona.writingDos.join("; ")}\nDo not: ${persona.writingDonts.join("; ")}`,
          },
        ],
      });
      if (response.output_text.trim()) {
        result = { text: response.output_text.trim(), usedAi: true, model };
      }
    } catch {
      // Provider failures can contain request metadata. Keep previews usable
      // without writing persona prompts or admin topics to server logs.
      console.error("[personas] preview generation fell back");
    }
  }
  await logAudit(persona.id, "persona.preview_generated", actorEmail, {
    topic,
    usedAi: result.usedAi,
    model: result.model,
  });
  return result;
}

export async function getPublicPersonaBySlug(
  slug: string
): Promise<PersonaPublicSnapshot | null> {
  "use cache";
  cacheTag("personas");
  cacheLife("hours");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("blog_author_personas")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data ? buildPersonaPublicSnapshot(mapPersona(data as PersonaRow)) : null;
}

export async function getPublishedPostsForPersona(personaId: string): Promise<BlogPost[]> {
  "use cache";
  cacheTag("blog", "personas");
  cacheLife("hours");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("blog_posts")
    .select(
      "id, title, slug, excerpt, status, reading_time_minutes, category_id, primary_keyword, published_at, updated_at, og_image_url, author_persona_id, author_persona_snapshot_json, author_type"
    )
    .eq("status", "published")
    .eq("author_persona_id", personaId)
    .order("published_at", { ascending: false });
  return (data ?? []) as unknown as BlogPost[];
}

export async function getPublishedPersonaSlugs(): Promise<
  { slug: string; updatedAt: string }[]
> {
  "use cache";
  cacheTag("blog", "personas");
  cacheLife("hours");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("blog_author_personas")
    .select("slug, updated_at, blog_posts!inner(id)")
    .eq("blog_posts.status", "published");
  const unique = new Map<string, string>();
  for (const row of data ?? []) unique.set(row.slug, row.updated_at);
  return [...unique].map(([slug, updatedAt]) => ({ slug, updatedAt }));
}
