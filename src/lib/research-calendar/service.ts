import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ResearchCalendarUpdateInput } from "./schemas";
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
      "Research calendar data is unavailable. Confirm migrations 024–026 were applied.",
      error
    );
  }

  return {
    calendar: (calendarResult.data as ResearchCalendar | null) ?? null,
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
  packets: GeneratedResearchPacket[];
}): Promise<ResearchPacketRow[]> {
  if (!input.packets.length) return [];
  const now = Date.now();
  const expiresAt = input.day.expire_trending_items
    ? new Date(now + input.day.packet_expiry_hours * 60 * 60 * 1000).toISOString()
    : null;
  const rows = input.packets.map((packet) => ({
    schedule_run_id: input.runId,
    calendar_day_id: input.day.id,
    theme_key: input.day.theme_key,
    theme_name: input.day.theme_name,
    target_audience: input.day.target_audience,
    suggested_personas: packet.suggestedPersonas,
    topic_title: packet.topicTitle,
    topic_angle: packet.topicAngle,
    summary: packet.summary,
    findings_json: packet.findings,
    source_refs_json: uniqueSources(packet),
    confidence_score: packet.confidenceScore,
    urgency: packet.urgency,
    content_type: packet.contentType,
    monetization_intent: packet.monetizationIntent,
    status:
      packet.confidenceScore >= input.day.min_research_confidence
        ? "ready_for_blog"
        : "needs_admin_review",
    expires_at: expiresAt,
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
