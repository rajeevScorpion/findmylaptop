import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BLOG_WRITER_PROMPT_VERSION,
  generateBlogFull,
  getBlogWriterModel,
  type BlogWriterPersonaContext,
} from "@/lib/ai/blog-writer";
import { buildToc, syncHeadingIds } from "@/lib/blog/toc";
import { readingTimeMinutes, uniqueSlug } from "@/lib/blog/slug";
import type { Block, BlogContentDoc } from "@/lib/blog/types";
import { AgentError } from "@/lib/growth-agents/errors";
import { getAgentSettings } from "@/lib/growth-agents/settings";
import {
  buildPersonaPublicSnapshot,
  listPersonas,
  selectPersonaForTopic,
} from "@/lib/personas/service";
import type { BlogAuthorPersona } from "@/lib/personas/types";
import type {
  ResearchCalendarDay,
  ResearchPacketRow,
} from "@/lib/research-calendar/types";
import { evaluateBlogDraftQuality } from "./quality";
import type { BlogAgentDraftRecord } from "./types";

const DRAFT_SELECT =
  "id, idempotency_key, generation_token, upstream_execution_token, agent_job_id, research_packet_id, blog_post_id, persona_id, persona_version, status, quality_score, quality_threshold, fact_check_json, source_refs_json, internal_link_suggestions_json, generation_model, prompt_version, error_code, error_message, created_by, created_at, updated_at";

export interface BlogDraftFromResearchOutcome {
  artifact: BlogAgentDraftRecord;
  blogPostId: string | null;
  status: "needs_review" | "quality_blocked" | "duplicate";
  qualityScore: number | null;
  message: string;
}

function databaseError(message: string, cause: unknown): AgentError {
  return new AgentError({
    code: "DATABASE_ERROR",
    message,
    retryable: true,
    cause,
  });
}

function mapDraft(row: Record<string, unknown>): BlogAgentDraftRecord {
  return {
    ...(row as unknown as BlogAgentDraftRecord),
    quality_score:
      row.quality_score === null || row.quality_score === undefined
        ? null
        : Number(row.quality_score),
    quality_threshold: Number(row.quality_threshold),
  };
}

async function getPacketContext(packetId: string): Promise<{
  packet: ResearchPacketRow;
  day: ResearchCalendarDay;
}> {
  const supabase = createAdminClient();
  const { data: packet, error: packetError } = await supabase
    .from("research_packets")
    .select("*")
    .eq("id", packetId)
    .maybeSingle();
  if (packetError) throw databaseError("Could not load the research packet.", packetError);
  if (!packet) {
    throw new AgentError({ code: "NOT_FOUND", message: "Research packet not found." });
  }
  if (!packet.calendar_day_id) {
    throw new AgentError({
      code: "CONFIGURATION_ERROR",
      message: "The research packet is not linked to a calendar day.",
    });
  }
  const { data: day, error: dayError } = await supabase
    .from("research_calendar_days")
    .select("*")
    .eq("id", packet.calendar_day_id)
    .maybeSingle();
  if (dayError) throw databaseError("Could not load the packet policy.", dayError);
  if (!day) {
    throw new AgentError({
      code: "CONFIGURATION_ERROR",
      message: "The research packet policy is missing.",
    });
  }
  return {
    packet: packet as ResearchPacketRow,
    day: day as ResearchCalendarDay,
  };
}

async function choosePersona(
  packet: ResearchPacketRow,
  day: ResearchCalendarDay,
  forcedPersonaId?: string,
  automatic = false
): Promise<{ persona: BlogAuthorPersona; reason: string }> {
  const isComparison = packet.content_type === "comparison";
  const personas = (await listPersonas({ activeOnly: true })).filter(
    (persona) =>
      persona.permissions.canWriteBlogs &&
      (!automatic || persona.permissions.canBeAutoScheduled) &&
      (!isComparison || persona.permissions.canWriteComparisons)
  );
  if (forcedPersonaId) {
    const forced = personas.find((persona) => persona.id === forcedPersonaId);
    if (!forced) {
      throw new AgentError({
        code: "ADMIN_APPROVAL_REQUIRED",
        message:
          "The requested persona is not active or lacks permission for this draft type.",
      });
    }
    return { persona: forced, reason: "Selected manually by an admin." };
  }

  const preferredSlugs = [
    ...packet.suggested_personas,
    ...day.preferred_persona_slugs,
  ];
  const preferred = preferredSlugs
    .map((slug) => personas.find((persona) => persona.slug === slug))
    .find((persona): persona is BlogAuthorPersona => Boolean(persona));
  if (preferred) {
    return {
      persona: preferred,
      reason: `Selected from the research calendar's preferred persona list (${preferred.slug}).`,
    };
  }

  const selected = await selectPersonaForTopic({
    topic: `${packet.topic_title}. ${packet.topic_angle}`,
    targetAudience: packet.target_audience,
    topicCategory: packet.content_type,
  });
  const eligibleSelection = selected
    ? personas.find((persona) => persona.id === selected.persona.id)
    : null;
  if (selected && eligibleSelection) {
    return { ...selected, persona: eligibleSelection };
  }
  const fallback =
    personas.find((persona) => persona.isDefaultFallback) ?? personas[0];
  if (!fallback) {
    throw new AgentError({
      code: "CONFIGURATION_ERROR",
      message: automatic
        ? "No active persona is permitted for automatic scheduling and this content type."
        : "No active blog author persona is permitted for this content type.",
    });
  }
  return {
    persona: fallback,
    reason:
      "The topic selector's first choice lacked this workflow permission, so the highest-priority eligible persona was selected.",
  };
}

function personaContext(persona: BlogAuthorPersona): BlogWriterPersonaContext {
  return {
    id: persona.id,
    version: persona.version,
    displayName: persona.displayName,
    publicRole: persona.publicRole,
    authorType: persona.authorType,
    disclosureText: persona.disclosureText,
    expertiseTags: persona.expertiseTags,
    toneSettings: persona.toneSettings,
    buyingPhilosophy: persona.buyingPhilosophy,
    writingDos: persona.writingDos,
    writingDonts: persona.writingDonts,
    writingGuidance: persona.personaSystemPrompt,
    affiliatePolicy: persona.affiliatePolicy,
    permissions: {
      canWriteComparisons: persona.permissions.canWriteComparisons,
      canInsertProductCards: persona.permissions.canInsertProductCards,
      alwaysRequiresManualReview: persona.permissions.alwaysRequiresManualReview,
    },
  };
}

function researchSourceText(packet: ResearchPacketRow): string {
  const findings = packet.findings_json.map((finding, index) =>
    [
      `Finding ${index + 1}: ${finding.title}`,
      `Summary: ${finding.summary}`,
      `Evidence: ${finding.evidence}`,
      `Verified source: ${finding.sourceTitle} (${finding.sourceUrl})`,
      finding.publishedAt ? `Source date: ${finding.publishedAt}` : null,
      `Finding confidence: ${finding.confidenceScore}/100`,
    ]
      .filter(Boolean)
      .join("\n")
  );
  return [
    `Research topic: ${packet.topic_title}`,
    `Editorial angle: ${packet.topic_angle}`,
    `Research summary: ${packet.summary}`,
    "Use only the evidence below for current factual claims. Attribute sources in plain language. Do not infer prices, products, benchmarks, personal experience, or missing facts.",
    ...findings,
  ].join("\n\n");
}

function appendEvidenceBlocks(
  blocks: unknown[],
  sources: Array<{ url: string; title?: string }>
): unknown[] {
  if (!sources.length) return blocks;
  return [
    ...blocks,
    {
      type: "heading",
      level: 2,
      text: "Sources reviewed",
      id: "sources-reviewed",
    },
    {
      type: "paragraph",
      text: "LaptopFinder editors should re-check these sources before publication, especially for time-sensitive claims.",
    },
    {
      type: "bullets",
      items: sources.map((source) => `${source.title ?? "Source"}: ${source.url}`),
    },
  ];
}

async function createArtifact(input: {
  idempotencyKey: string;
  packetId: string;
  persona: BlogAuthorPersona;
  qualityThreshold: number;
  requestedBy: string;
  agentJobId?: string;
  upstreamExecutionToken?: string;
}): Promise<{ artifact: BlogAgentDraftRecord; created: boolean }> {
  const supabase = createAdminClient();
  const generationToken = randomUUID();
  const { data, error } = await supabase
    .from("blog_agent_drafts")
    .insert({
      idempotency_key: input.idempotencyKey,
      generation_token: generationToken,
      upstream_execution_token: input.upstreamExecutionToken ?? null,
      agent_job_id: input.agentJobId ?? null,
      research_packet_id: input.packetId,
      persona_id: input.persona.id,
      persona_version: input.persona.version,
      status: "generating",
      quality_threshold: input.qualityThreshold,
      created_by: input.requestedBy,
    })
    .select(DRAFT_SELECT)
    .single();
  if (!error && data) return { artifact: mapDraft(data), created: true };
  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await supabase
      .from("blog_agent_drafts")
      .select(DRAFT_SELECT)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (!existingError && existing) {
      const artifact = mapDraft(existing);
      const staleBefore = new Date(Date.now() - 30 * 60 * 1_000).toISOString();
      const upstreamWasReclaimed = Boolean(
        input.upstreamExecutionToken &&
          artifact.upstream_execution_token &&
          input.upstreamExecutionToken !== artifact.upstream_execution_token
      );
      const canReclaim =
        artifact.status === "failed" ||
        (artifact.status === "generating" &&
          (artifact.updated_at < staleBefore || upstreamWasReclaimed));
      if (canReclaim) {
        const nextGenerationToken = randomUUID();
        let reclaim = supabase
          .from("blog_agent_drafts")
          .update({
            agent_job_id: input.agentJobId ?? null,
            generation_token: nextGenerationToken,
            upstream_execution_token: input.upstreamExecutionToken ?? null,
            status: "generating",
            quality_threshold: input.qualityThreshold,
            quality_score: null,
            fact_check_json: [],
            source_refs_json: [],
            internal_link_suggestions_json: [],
            generation_model: null,
            prompt_version: null,
            error_code: null,
            error_message: null,
          })
          .eq("id", artifact.id)
          .eq("generation_token", artifact.generation_token);
        reclaim =
          artifact.status === "failed"
            ? reclaim.eq("status", "failed")
            : upstreamWasReclaimed
              ? reclaim
                  .eq("status", "generating")
                  .eq(
                    "upstream_execution_token",
                    artifact.upstream_execution_token!
                  )
              : reclaim.eq("status", "generating").lt("updated_at", staleBefore);
        const { data: reclaimed, error: reclaimError } = await reclaim
          .select(DRAFT_SELECT)
          .maybeSingle();
        if (reclaimError) {
          throw databaseError("Could not retry the blog draft artifact.", reclaimError);
        }
        if (reclaimed) return { artifact: mapDraft(reclaimed), created: true };
      }

      // A concurrent retry may have reclaimed it after our initial read.
      const { data: current, error: currentError } = await supabase
        .from("blog_agent_drafts")
        .select(DRAFT_SELECT)
        .eq("id", artifact.id)
        .single();
      if (currentError || !current) {
        throw databaseError("Could not reload the blog draft artifact.", currentError);
      }
      return { artifact: mapDraft(current), created: false };
    }
  }
  throw databaseError("Could not create the blog draft artifact.", error);
}

async function uniquePostSlug(value: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("blog_posts").select("slug");
  if (error) throw databaseError("Could not check the blog post slug.", error);
  return uniqueSlug(value, new Set((data ?? []).map((row) => row.slug as string)));
}

async function resolveCategoryId(name: string | undefined): Promise<string | null> {
  if (!name) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("blog_categories")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function updateArtifact(
  id: string,
  generationToken: string,
  patch: Record<string, unknown>
): Promise<BlogAgentDraftRecord> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("blog_agent_drafts")
    .update(patch)
    .eq("id", id)
    .eq("generation_token", generationToken)
    .eq("status", "generating")
    .select(DRAFT_SELECT)
    .maybeSingle();
  if (error) throw databaseError("Could not update the blog draft artifact.", error);
  if (!data) {
    throw new AgentError({
      code: "CONFLICT",
      message: "The blog generation lease is no longer current.",
      retryable: true,
    });
  }
  return mapDraft(data);
}

async function assertAgentJobLease(input: {
  agentJobId?: string;
  agentJobLockToken?: string;
}): Promise<void> {
  if (!input.agentJobId && !input.agentJobLockToken) return;
  if (!input.agentJobId || !input.agentJobLockToken) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: "Both upstream agent job lease values are required.",
    });
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("agent_jobs")
    .select("id")
    .eq("id", input.agentJobId)
    .eq("status", "running")
    .eq("lock_token", input.agentJobLockToken)
    .gt("lock_expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw databaseError("Could not validate the upstream job lease.", error);
  if (!data) {
    throw new AgentError({
      code: "CONFLICT",
      message: "The upstream agent job lease is no longer current.",
      retryable: true,
    });
  }
}

async function notify(input: {
  category: string;
  severity?: "info" | "warning" | "error";
  title: string;
  message: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("admin_notifications").insert({
    category: input.category,
    severity: input.severity ?? "info",
    title: input.title,
    message: input.message,
    metadata_json: input.metadata,
  });
  if (error) console.error("Blog Agent notification insert failed", error.code);
}

export async function createBlogDraftFromResearchPacket(input: {
  researchPacketId: string;
  requestedBy: string;
  agentJobId?: string;
  agentJobLockToken?: string;
  researchExecutionToken?: string;
  personaId?: string;
  automatic?: boolean;
}): Promise<BlogDraftFromResearchOutcome> {
  await assertAgentJobLease({
    agentJobId: input.agentJobId,
    agentJobLockToken: input.agentJobLockToken,
  });

  const settings = await getAgentSettings();
  if (settings.emergencyStop || settings.globalPause || !settings.bloggingAgentEnabled) {
    throw new AgentError({
      code: "CONFIGURATION_ERROR",
      message: "The Blogging Agent is disabled or paused.",
    });
  }

  const { packet, day } = await getPacketContext(input.researchPacketId);
  if (packet.expires_at && new Date(packet.expires_at).getTime() <= Date.now()) {
    await createAdminClient()
      .from("research_packets")
      .update({ status: "expired" })
      .eq("id", packet.id);
    throw new AgentError({
      code: "ADMIN_APPROVAL_REQUIRED",
      message: "This research packet has expired and must be refreshed.",
    });
  }
  if (packet.status !== "ready_for_blog") {
    throw new AgentError({
      code: "ADMIN_APPROVAL_REQUIRED",
      message: `Research packet is ${packet.status.replaceAll("_", " ")}, not ready for draft generation.`,
    });
  }
  if (packet.confidence_score < day.min_research_confidence) {
    throw new AgentError({
      code: "ADMIN_APPROVAL_REQUIRED",
      message: "The packet does not meet the calendar's research confidence threshold.",
    });
  }

  const selected = await choosePersona(
    packet,
    day,
    input.personaId,
    input.automatic === true
  );
  const idempotencyKey = `blog:${packet.id}:${selected.persona.id}:v${selected.persona.version}`;
  const start = await createArtifact({
    idempotencyKey,
    packetId: packet.id,
    persona: selected.persona,
    qualityThreshold: day.min_blog_quality,
    requestedBy: input.requestedBy,
    agentJobId: input.agentJobId,
    upstreamExecutionToken: input.researchExecutionToken,
  });
  if (!start.created) {
    return {
      artifact: start.artifact,
      blogPostId: start.artifact.blog_post_id,
      status: "duplicate",
      qualityScore: start.artifact.quality_score,
      message: "This research packet and persona version already have a draft run.",
    };
  }

  const model = getBlogWriterModel();
  try {
    const result = await generateBlogFull({
      generationType: "full",
      topic: packet.topic_title,
      brief: `${packet.topic_angle}\n\nWrite an evidence-led ${packet.content_type} for ${packet.target_audience.join(", ")}. Nothing may imply publication approval.`,
      audience: packet.target_audience,
      primaryKeyword: packet.topic_title,
      secondaryKeywords: [],
      templateType: packet.content_type,
      includeProducts: false,
      targetLength: "long",
      sourceText: researchSourceText(packet),
      sourcePolicy: "untrusted_research_evidence",
      personaContext: personaContext(selected.persona),
    });
    const blocks = appendEvidenceBlocks(
      result.data.content.blocks,
      packet.source_refs_json
    );
    const quality = evaluateBlogDraftQuality({
      blocks,
      researchConfidence: packet.confidence_score,
      researchThreshold: day.min_research_confidence,
      blogThreshold: day.min_blog_quality,
      sourceCount: packet.source_refs_json.length,
      hasPersonaDisclosure: Boolean(selected.persona.disclosureText.trim()),
    });
    await assertAgentJobLease({
      agentJobId: input.agentJobId,
      agentJobLockToken: input.agentJobLockToken,
    });
    const internalLinks = [
      { href: "/", reason: "Guide readers to the LaptopFinder recommendation flow." },
      { href: "/blog", reason: "Connect readers to reviewed LaptopFinder guides." },
    ];

    if (!quality.passed) {
      const artifact = await updateArtifact(
        start.artifact.id,
        start.artifact.generation_token,
        {
        status: "quality_blocked",
        quality_score: quality.score,
        fact_check_json: quality.checks,
        source_refs_json: packet.source_refs_json,
        internal_link_suggestions_json: internalLinks,
        generation_model: model,
        prompt_version: BLOG_WRITER_PROMPT_VERSION,
        error_code: "quality_threshold_not_met",
        error_message: "Generated content did not meet every quality and safety gate.",
        }
      );
      await createAdminClient()
        .from("research_packets")
        .update({ status: "needs_admin_review" })
        .eq("id", packet.id);
      await notify({
        category: "blog.quality_blocked",
        severity: "warning",
        title: `Blog draft blocked: ${packet.topic_title}`,
        message: `The generated result scored ${quality.score}/100 and was not saved as a CMS post.`,
        metadata: { artifactId: artifact.id, researchPacketId: packet.id },
      });
      return {
        artifact,
        blogPostId: null,
        status: "quality_blocked",
        qualityScore: quality.score,
        message: "Generation completed, but quality gates blocked the CMS draft.",
      };
    }

    const doc = syncHeadingIds({
      type: "doc",
      blocks: blocks as Block[],
    });
    const slug = await uniquePostSlug(result.data.slug || result.data.title);
    const categoryId = await resolveCategoryId(result.data.suggested_category);
    const snapshot = buildPersonaPublicSnapshot(selected.persona);
    const supabase = createAdminClient();
    const { data: persisted, error: persistError } = await supabase.rpc(
      "persist_blog_agent_post",
      {
        p_artifact_id: start.artifact.id,
        p_generation_token: start.artifact.generation_token,
        p_agent_job_id: input.agentJobId ?? null,
        p_agent_job_lock_token: input.agentJobLockToken ?? null,
        p_post: {
        title: result.data.title,
        slug,
        excerpt: result.data.excerpt ?? packet.summary,
        content_json: doc satisfies BlogContentDoc,
        toc_json: buildToc(doc),
        template_type: packet.content_type,
        audience: packet.target_audience,
        primary_keyword: result.data.primary_keyword ?? packet.topic_title,
        secondary_keywords: result.data.secondary_keywords ?? [],
        meta_title: result.data.meta_title ?? null,
        meta_description: result.data.meta_description ?? null,
        og_title: result.data.og_title ?? null,
        og_description: result.data.og_description ?? null,
        reading_time_minutes: readingTimeMinutes(doc),
        category_id: categoryId,
        ai_inputs: {
          topic: packet.topic_title,
          brief: packet.topic_angle,
          sourceText: `Evidence is stored in blog_agent_drafts ${start.artifact.id}.`,
          targetLength: "long",
          audience: packet.target_audience.join(", "),
          template: packet.content_type,
        },
        author_persona_snapshot_json: snapshot,
        author_type: snapshot.authorType,
        persona_selection_reason: selected.reason,
        persona_generated: true,
        },
        p_quality_score: quality.score,
        p_fact_check: quality.checks,
        p_source_refs: packet.source_refs_json,
        p_internal_links: internalLinks,
        p_generation_model: model,
        p_prompt_version: BLOG_WRITER_PROMPT_VERSION,
      }
    );
    const postId = (persisted as Array<{ blog_post_id?: string }> | null)?.[0]
      ?.blog_post_id;
    if (persistError || !postId) {
      throw databaseError("Could not atomically save the CMS draft.", persistError);
    }
    const { data: persistedArtifact, error: artifactError } = await supabase
      .from("blog_agent_drafts")
      .select(DRAFT_SELECT)
      .eq("id", start.artifact.id)
      .eq("generation_token", start.artifact.generation_token)
      .eq("blog_post_id", postId)
      .single();
    if (artifactError || !persistedArtifact) {
      throw databaseError("Could not reload the saved blog draft artifact.", artifactError);
    }
    const artifact = mapDraft(persistedArtifact);

    const sideEffects = await Promise.allSettled([
      supabase
        .from("research_packets")
        .update({ status: "used", used_at: new Date().toISOString() })
        .eq("id", packet.id),
      supabase.from("ai_generation_logs").insert({
        post_id: postId,
        generation_type: "research_packet_full",
        model,
        prompt_version: BLOG_WRITER_PROMPT_VERSION,
        input_topic: packet.topic_title,
        input_brief: packet.topic_angle,
        input_keywords: [],
        output_status: "success",
        tokens_input: result.usage.tokens_input ?? null,
        tokens_output: result.usage.tokens_output ?? null,
        tokens_cached: result.usage.tokens_cached ?? null,
        created_by: input.requestedBy,
      }),
      supabase.from("audit_events").insert({
        event_type: "blog.draft_generated",
        actor_type: input.requestedBy === "cron" ? "cron" : "admin",
        actor_identifier: input.requestedBy,
        entity_type: "blog_post",
        entity_id: postId,
        summary: "Blogging Agent created a review-only CMS draft.",
        metadata_json: {
          researchPacketId: packet.id,
          artifactId: artifact.id,
          personaId: selected.persona.id,
          personaVersion: selected.persona.version,
          qualityScore: quality.score,
        },
      }),
    ]);
    for (const sideEffect of sideEffects) {
      if (sideEffect.status === "rejected") {
        console.error("Blog Agent follow-up write failed");
      } else if (sideEffect.value.error) {
        console.error(
          "Blog Agent follow-up write failed",
          sideEffect.value.error.code
        );
      }
    }
    await notify({
      category: "blog.draft_ready",
      title: `Draft ready for review: ${result.data.title}`,
      message: `Quality score ${quality.score}/100. The post remains AI-generated and unpublished.`,
      metadata: { artifactId: artifact.id, blogPostId: postId },
    });

    return {
      artifact,
      blogPostId: postId,
      status: "needs_review",
      qualityScore: quality.score,
      message: "A quality-gated CMS draft was created for admin review.",
    };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code.slice(0, 120)
        : "blog_generation_failed";
    const message =
      error instanceof Error ? error.message.slice(0, 2_000) : "Blog draft generation failed.";
    try {
      await updateArtifact(start.artifact.id, start.artifact.generation_token, {
        status: "failed",
        generation_model: model,
        prompt_version: BLOG_WRITER_PROMPT_VERSION,
        error_code: code,
        error_message: message,
      });
    } catch {
      console.error("Could not record failed blog artifact");
    }
    throw error instanceof AgentError
      ? error
      : new AgentError({
          code: "LLM_GENERATION_FAILED",
          message: "The Blogging Agent could not create a valid draft.",
          retryable: true,
          cause: error,
        });
  }
}

export async function listBlogAgentDrafts(limit = 50): Promise<BlogAgentDraftRecord[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("blog_agent_drafts")
    .select(DRAFT_SELECT)
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  if (error) throw databaseError("Could not list Blogging Agent drafts.", error);
  return (data ?? []).map((row) => mapDraft(row));
}

export async function listBloggableResearchPackets(
  limit = 50
): Promise<ResearchPacketRow[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("research_packets")
    .select("*")
    .eq("status", "ready_for_blog")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("urgency", { ascending: false })
    .order("confidence_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  if (error) throw databaseError("Could not list blog-ready research packets.", error);
  return (data ?? []) as ResearchPacketRow[];
}

export async function countCreatedBlogAgentDraftsSince(
  since: Date
): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("blog_agent_drafts")
    .select("id", { count: "exact", head: true })
    .in("status", ["generated", "needs_review"])
    .gte("created_at", since.toISOString());
  if (error) throw databaseError("Could not count recent Blogging Agent drafts.", error);
  return count ?? 0;
}
