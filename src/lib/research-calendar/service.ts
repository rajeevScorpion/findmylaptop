import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ResearchCalendarUpdateInput } from "./schemas";
import { getResearchNoveltyPolicy } from "./novelty";
import type {
  NovelResearchPacket,
  NoveltyReference,
  SourceRotationUse,
} from "./novelty";
import {
  buildScheduleIdempotencyKeyForDate,
  listDueScheduleOccurrences,
} from "./time";
import type {
  GeneratedResearchPacket,
  ResearchCalendar,
  ResearchCalendarDashboard,
  ResearchCalendarDay,
  ResearchPacketRow,
  ResearchScheduleRun,
} from "./types";

const DEFAULT_CALENDAR_ID = "00000000-0000-4000-8000-000000000026";

function databaseError(message: string, cause?: unknown): Error {
  const error = new Error(message, cause ? { cause } : undefined);
  (error as Error & { code?: string }).code = "database_error";
  return error;
}

function researchHistoryLimitError(limit: number): Error {
  const error = new Error(
    `Research novelty history exceeded the safe ${limit}-item comparison limit. Shorten the topic history window or archive obsolete CMS posts before running research.`
  );
  (error as Error & { code?: string }).code =
    "research_novelty_history_limit_exceeded";
  return error;
}

function sourceUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.flatMap((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
        const url = (entry as Record<string, unknown>).url;
        return typeof url === "string" && url.trim() ? [url.trim()] : [];
      })
    )
  );
}

/**
 * Load the bounded, platform-wide editorial history used by the deterministic
 * novelty gate. A read failure is fatal so a run cannot silently forget prior
 * coverage and create a repeat.
 */
export async function listResearchTopicHistory(input: {
  now: Date;
  windowDays: number;
  limit?: number;
}): Promise<NoveltyReference[]> {
  const limit = Math.min(Math.max(input.limit ?? 500, 50), 500);
  const cutoff = new Date(
    input.now.getTime() - input.windowDays * 24 * 60 * 60 * 1_000
  ).toISOString();
  const rejectedCutoff = new Date(
    input.now.getTime() - 30 * 24 * 60 * 60 * 1_000
  ).toISOString();
  const supabase = createAdminClient();
  const packetSelect =
    "id,schedule_run_id,calendar_day_id,topic_title,topic_angle,summary,content_type,target_audience,source_refs_json,status,confidence_score,created_at";
  const [packetResult, rejectedPacketResult, postResult] = await Promise.all([
    supabase
      .from("research_packets")
      .select(packetSelect)
      .neq("status", "rejected")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(limit + 1),
    supabase
      .from("research_packets")
      .select(packetSelect)
      .eq("status", "rejected")
      .gte("created_at", rejectedCutoff)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(limit + 1),
    supabase
      .from("blog_posts")
      .select(
        "id,title,excerpt,template_type,audience,primary_keyword,secondary_keywords,status,created_at"
      )
      .neq("status", "archived")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(limit + 1),
  ]);
  if (packetResult.error || rejectedPacketResult.error || postResult.error) {
    throw databaseError(
      "Could not load the editorial topic history required for novelty checks.",
      packetResult.error ?? rejectedPacketResult.error ?? postResult.error
    );
  }

  const packetRows = [
    ...(packetResult.data ?? []),
    ...(rejectedPacketResult.data ?? []),
  ];
  const postRows = postResult.data ?? [];
  if (packetRows.length + postRows.length > limit) {
    throw researchHistoryLimitError(limit);
  }

  const packetHistory: NoveltyReference[] = packetRows.map((row) => ({
    id: row.id,
    kind: "research_packet",
    title: row.topic_title,
    angle: row.topic_angle,
    summary: row.summary,
    contentType: row.content_type,
    audiences: row.target_audience ?? [],
    sourceUrls: sourceUrls(row.source_refs_json),
    confidenceScore: row.confidence_score,
    createdAt: row.created_at,
    status: row.status,
    calendarDayId: row.calendar_day_id,
    scheduleRunId: row.schedule_run_id,
  }));
  const postHistory: NoveltyReference[] = postRows.map((row) => ({
    id: row.id,
    kind: "blog_post",
    title: row.title,
    angle: row.primary_keyword,
    summary:
      row.excerpt ??
      [row.primary_keyword, ...(row.secondary_keywords ?? [])]
        .filter(Boolean)
        .join(", "),
    contentType: row.template_type,
    audiences: row.audience ?? [],
    sourceUrls: [],
    createdAt: row.created_at,
    status: row.status,
    calendarDayId: null,
    scheduleRunId: null,
  }));

  return [...packetHistory, ...postHistory]
    .sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) ||
        left.kind.localeCompare(right.kind) ||
        left.id.localeCompare(right.id)
    )
    .slice(0, limit);
}

/** Source rotation has its own bounded history so platform-wide topic volume
 * cannot evict the most recent non-empty runs for this calendar day. */
export async function listRecentResearchSourceUses(input: {
  calendarDayId: string;
  currentScheduleRunId: string;
  now: Date;
  cooldownDays: number;
  runLimit: number;
}): Promise<SourceRotationUse[]> {
  if (input.runLimit <= 0 || input.cooldownDays <= 0) return [];
  const cutoff = new Date(
    input.now.getTime() - input.cooldownDays * 24 * 60 * 60 * 1_000
  ).toISOString();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("research_packets")
    .select("id,schedule_run_id,source_refs_json,created_at")
    .eq("calendar_day_id", input.calendarDayId)
    .neq("schedule_run_id", input.currentScheduleRunId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(Math.min(Math.max(input.runLimit * 20 + 1, 41), 201));
  if (error) {
    throw databaseError(
      "Could not load recent source usage required for source rotation.",
      error
    );
  }

  const byRun = new Map<
    string,
    { usedAt: string; sourceUrls: Set<string> }
  >();
  for (const row of data ?? []) {
    const current = byRun.get(row.schedule_run_id) ?? {
      usedAt: row.created_at,
      sourceUrls: new Set<string>(),
    };
    if (row.created_at > current.usedAt) current.usedAt = row.created_at;
    for (const url of sourceUrls(row.source_refs_json)) {
      current.sourceUrls.add(url);
    }
    byRun.set(row.schedule_run_id, current);
  }

  return [...byRun.entries()]
    .map(([runId, value]) => ({
      runId,
      usedAt: value.usedAt,
      sourceUrls: [...value.sourceUrls].sort(),
    }))
    .filter((use) => use.sourceUrls.length > 0)
    .sort(
      (left, right) =>
        right.usedAt.localeCompare(left.usedAt) ||
        left.runId.localeCompare(right.runId)
    )
    .slice(0, input.runLimit);
}

export async function getResearchCalendarDashboard(
  calendarId = DEFAULT_CALENDAR_ID
): Promise<ResearchCalendarDashboard> {
  const supabase = createAdminClient();
  const [calendarResult, daysResult, runsResult, packetsResult] =
    await Promise.all([
      supabase
        .from("research_editorial_calendars")
        .select("*")
        .eq("id", calendarId)
        .maybeSingle(),
      supabase
        .from("research_calendar_days")
        .select("*")
        .eq("calendar_id", calendarId)
        .order("weekday", { ascending: true })
        .order("sort_order", { ascending: true }),
      supabase
        .from("research_schedule_runs")
        .select("*")
        .eq("calendar_id", calendarId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("research_packets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const error =
    calendarResult.error ||
    daysResult.error ||
    runsResult.error ||
    packetsResult.error;
  if (error) {
    throw databaseError(
      "Research calendar data is unavailable. Confirm migrations 024–033 were applied.",
      error
    );
  }

  const calendar = (calendarResult.data as ResearchCalendar | null) ?? null;
  if (calendar) getResearchNoveltyPolicy(calendar);

  return {
    calendar,
    days: (daysResult.data ?? []) as ResearchCalendarDay[],
    recentRuns: (runsResult.data ?? []) as ResearchScheduleRun[],
    recentPackets: (packetsResult.data ?? []) as ResearchPacketRow[],
  };
}

export async function updateResearchCalendar(
  calendarId: string,
  input: ResearchCalendarUpdateInput,
  adminEmail: string
): Promise<ResearchCalendarDashboard> {
  const supabase = createAdminClient();

  if (input.calendar) {
    const { error } = await supabase
      .from("research_editorial_calendars")
      .update({ ...input.calendar, updated_by: adminEmail })
      .eq("id", calendarId);
    if (error) throw databaseError("Could not update the research calendar.", error);
  }

  for (const dayPatch of input.days ?? []) {
    const { id, ...patch } = dayPatch;
    const { error } = await supabase
      .from("research_calendar_days")
      .update(patch)
      .eq("id", id)
      .eq("calendar_id", calendarId);
    if (error) {
      throw databaseError(`Could not update calendar day ${id}.`, error);
    }
  }

  await supabase.from("audit_events").insert({
    event_type: "research_calendar.updated",
    actor_type: "admin",
    actor_identifier: adminEmail,
    entity_type: "research_editorial_calendar",
    entity_id: calendarId,
    summary: "Research calendar configuration updated.",
    metadata_json: {
      calendarFields: Object.keys(input.calendar ?? {}),
      dayIds: (input.days ?? []).map((day) => day.id),
    },
  });

  return getResearchCalendarDashboard(calendarId);
}

export async function getResearchCalendarDay(
  dayId: string
): Promise<{ calendar: ResearchCalendar; day: ResearchCalendarDay } | null> {
  const supabase = createAdminClient();
  const { data: day, error: dayError } = await supabase
    .from("research_calendar_days")
    .select("*")
    .eq("id", dayId)
    .maybeSingle();
  if (dayError) throw databaseError("Could not load the research day.", dayError);
  if (!day) return null;

  const { data: calendar, error: calendarError } = await supabase
    .from("research_editorial_calendars")
    .select("*")
    .eq("id", day.calendar_id)
    .maybeSingle();
  if (calendarError) {
    throw databaseError("Could not load the research calendar.", calendarError);
  }
  if (!calendar) return null;
  getResearchNoveltyPolicy(calendar as ResearchCalendar);
  return {
    calendar: calendar as ResearchCalendar,
    day: day as ResearchCalendarDay,
  };
}

export async function listDueResearchDays(
  now = new Date()
): Promise<
  Array<{
    calendar: ResearchCalendar;
    day: ResearchCalendarDay;
    scheduleDate: string;
    scheduledFor: string;
  }>
> {
  const supabase = createAdminClient();
  const { data: calendars, error: calendarError } = await supabase
    .from("research_editorial_calendars")
    .select("*")
    .eq("enabled", true)
    .eq("paused", false);
  if (calendarError) {
    throw databaseError("Could not load active research calendars.", calendarError);
  }
  if (!calendars?.length) return [];

  const calendarRows = calendars as ResearchCalendar[];
  for (const calendar of calendarRows) getResearchNoveltyPolicy(calendar);
  const { data: days, error: daysError } = await supabase
    .from("research_calendar_days")
    .select("*")
    .in(
      "calendar_id",
      calendarRows.map((calendar) => calendar.id)
    )
    .eq("enabled", true);
  if (daysError) throw databaseError("Could not load active research days.", daysError);

  const byId = new Map(calendarRows.map((calendar) => [calendar.id, calendar]));
  const candidates = ((days ?? []) as ResearchCalendarDay[])
    .flatMap((day) => {
      const calendar = byId.get(day.calendar_id);
      if (!calendar) return [];
      return listDueScheduleOccurrences(day, now, calendar.timezone).map(
        (occurrence) => ({
          calendar,
          day,
          scheduleDate: occurrence.scheduleDate,
          scheduledFor: occurrence.scheduledFor,
        })
      );
    })
    .sort((left, right) => left.scheduledFor.localeCompare(right.scheduledFor));
  if (!candidates.length) return [];

  // Avoid repeatedly spending the bounded cron budget on terminal or queued
  // occurrences. Unique inserts remain the final race-safe boundary.
  const scheduleKeys = candidates.map((entry) =>
    buildScheduleIdempotencyKeyForDate(entry.day.id, entry.scheduleDate)
  );
  const [runsResult, jobsResult] = await Promise.all([
    supabase
      .from("research_schedule_runs")
      .select("idempotency_key")
      .in("idempotency_key", scheduleKeys),
    supabase
      .from("agent_jobs")
      .select("idempotency_key")
      .in(
        "idempotency_key",
        scheduleKeys.map((key) => `job:${key}`)
      ),
  ]);
  if (runsResult.error || jobsResult.error) {
    throw databaseError(
      "Could not check existing research schedule work.",
      runsResult.error ?? jobsResult.error
    );
  }
  const existingRuns = new Set(
    (runsResult.data ?? []).map((row) => row.idempotency_key)
  );
  const existingJobs = new Set(
    (jobsResult.data ?? []).map((row) => row.idempotency_key)
  );
  return candidates.filter((entry) => {
    const key = buildScheduleIdempotencyKeyForDate(
      entry.day.id,
      entry.scheduleDate
    );
    return !existingRuns.has(key) && !existingJobs.has(`job:${key}`);
  });
}

export async function createResearchScheduleRun(input: {
  calendar: ResearchCalendar;
  day: ResearchCalendarDay;
  triggerType: "scheduled" | "manual" | "retry";
  scheduleDate: string;
  scheduledFor: string;
  idempotencyKey: string;
  now?: Date;
  agentJobId: string;
  executionToken: string;
}): Promise<{ run: ResearchScheduleRun; duplicate: boolean }> {
  const now = input.now ?? new Date();
  const baseKey = buildScheduleIdempotencyKeyForDate(
    input.day.id,
    input.scheduleDate
  );
  if (
    (input.triggerType === "scheduled" && input.idempotencyKey !== baseKey) ||
    (input.triggerType !== "scheduled" &&
      input.idempotencyKey !== baseKey &&
      !input.idempotencyKey.startsWith(`${baseKey}:manual:`))
  ) {
    throw new Error("Research schedule idempotency key does not match its local date.");
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .rpc("claim_research_schedule_run", {
      p_calendar_id: input.calendar.id,
      p_calendar_day_id: input.day.id,
      p_agent_job_id: input.agentJobId,
      p_execution_token: input.executionToken,
      p_trigger_type: input.triggerType,
      p_scheduled_for: input.scheduledFor,
      p_idempotency_key: input.idempotencyKey,
      p_started_at: now.toISOString(),
    });
  if (error) throw databaseError("Could not start the research run.", error);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw databaseError("The research run claim returned an invalid result.");
  }
  const result = data as { run?: unknown; duplicate?: unknown };
  if (!result.run || typeof result.run !== "object") {
    throw databaseError("The research run claim did not return a run.");
  }
  return {
    run: result.run as ResearchScheduleRun,
    duplicate: result.duplicate === true,
  };
}

export async function finishResearchScheduleRun(
  runId: string,
  input: {
    agentJobId: string;
    executionToken: string;
    status: ResearchScheduleRun["status"];
    expectedStartedAt: string;
    packetsProduced?: number;
    draftsProduced?: number;
    result?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
    sourceFailures?: unknown[];
  }
): Promise<void> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .rpc("finish_research_schedule_run", {
      p_schedule_run_id: runId,
      p_agent_job_id: input.agentJobId,
      p_execution_token: input.executionToken,
      p_expected_started_at: input.expectedStartedAt,
      p_status: input.status,
      p_packets_produced: input.packetsProduced ?? 0,
      p_drafts_produced: input.draftsProduced ?? 0,
      p_result: input.result ?? {},
      p_error_code: input.errorCode ?? null,
      p_error_message: input.errorMessage ?? null,
      p_source_failures: input.sourceFailures ?? [],
      p_finished_at: new Date().toISOString(),
    });
  if (error) throw databaseError("Could not finish the research run.", error);
  if (data !== true) {
    throw databaseError(
      "Could not finish the research run because its execution lease changed.",
      null
    );
  }
}

export async function claimResearchNoveltyLease(input: {
  runId: string;
  agentJobId: string;
  executionToken: string;
  now: Date;
  leaseSeconds?: number;
}): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("claim_research_novelty_lease", {
    p_schedule_run_id: input.runId,
    p_agent_job_id: input.agentJobId,
    p_execution_token: input.executionToken,
    p_now: input.now.toISOString(),
    p_lease_seconds: input.leaseSeconds ?? 1_800,
  });
  if (error) {
    throw databaseError("Could not claim the research novelty lease.", error);
  }
  return data === true;
}

export async function releaseResearchNoveltyLease(input: {
  runId: string;
  agentJobId: string;
  executionToken: string;
}): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("release_research_novelty_lease", {
    p_schedule_run_id: input.runId,
    p_agent_job_id: input.agentJobId,
    p_execution_token: input.executionToken,
  });
  if (error) {
    throw databaseError("Could not release the research novelty lease.", error);
  }
  return data === true;
}

function uniqueSources(packet: GeneratedResearchPacket) {
  return Array.from(
    new Map(
      packet.findings.map((finding) => [
        finding.sourceUrl,
        { url: finding.sourceUrl, title: finding.sourceTitle },
      ])
    ).values()
  );
}

export async function saveResearchPackets(input: {
  runId: string;
  agentJobId: string;
  executionToken: string;
  day: ResearchCalendarDay;
  packets: NovelResearchPacket[];
  now?: Date;
}): Promise<ResearchPacketRow[]> {
  const now = input.now ?? new Date();
  const expiresAt = input.day.expire_trending_items
    ? new Date(
        now.getTime() + input.day.packet_expiry_hours * 60 * 60 * 1000
      ).toISOString()
    : null;
  const rows = input.packets.map((selected) => ({
    schedule_run_id: input.runId,
    calendar_day_id: input.day.id,
    theme_key: input.day.theme_key,
    theme_name: input.day.theme_name,
    target_audience: input.day.target_audience,
    suggested_personas: selected.packet.suggestedPersonas,
    topic_title: selected.packet.topicTitle,
    topic_angle: selected.packet.topicAngle,
    summary: selected.packet.summary,
    findings_json: selected.packet.findings,
    source_refs_json: uniqueSources(selected.packet),
    confidence_score: selected.packet.confidenceScore,
    urgency: selected.packet.urgency,
    content_type: selected.packet.contentType,
    monetization_intent: selected.packet.monetizationIntent,
    status:
      selected.packet.confidenceScore >= input.day.min_research_confidence
        ? "ready_for_blog"
        : "needs_admin_review",
    expires_at: expiresAt,
    topic_fingerprint: selected.topicFingerprint,
    subject_key: selected.subjectKey,
    novelty_score: selected.noveltyScore,
    nearest_topic_similarity: selected.nearestTopicSimilarity,
    nearest_topic_kind: selected.nearestTopicKind,
    nearest_topic_id: selected.nearestTopicId,
    nearest_topic_title: selected.nearestTopicTitle,
    novelty_window_days: selected.noveltyWindowDays,
    novelty_checked_at: selected.noveltyCheckedAt,
    source_domains: selected.sourceDomains,
  }));

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .rpc("persist_research_packets", {
      p_schedule_run_id: input.runId,
      p_agent_job_id: input.agentJobId,
      p_execution_token: input.executionToken,
      p_packets: rows,
    });
  if (error) throw databaseError("Could not save research packets.", error);
  return (data ?? []) as ResearchPacketRow[];
}

export async function expireStaleResearchPackets(): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("research_packets")
    .update({ status: "expired" })
    .lt("expires_at", new Date().toISOString())
    .in("status", ["draft_packet", "ready_for_blog", "needs_admin_review"])
    .select("id");
  if (error) throw databaseError("Could not expire stale research packets.", error);
  return data?.length ?? 0;
}

export async function notifyResearchAdmin(input: {
  type: string;
  title: string;
  message: string;
  severity?: "info" | "warning" | "error";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("admin_notifications").insert({
    category: input.type,
    title: input.title,
    message: input.message,
    severity: input.severity ?? "info",
    metadata_json: input.metadata ?? {},
  });
  if (error) throw databaseError("Could not create an admin notification.", error);
}

export { DEFAULT_CALENDAR_ID };
