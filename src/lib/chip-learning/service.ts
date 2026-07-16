import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgentError } from "@/lib/growth-agents/errors";
import type { GrowthAgentDatabaseClient } from "@/lib/growth-agents/types";
import {
  countChipPreferenceSignals,
  hasChipPreferenceSignals,
} from "./heuristics";
import type {
  ChipPreferenceSignals,
  ChipSessionProfileRecord,
  RecordChipLearningTurnInput,
} from "./types";

const CHIP_PROFILE_SELECT =
  "id, anonymous_session_hash, domain, budget_min, budget_max, role_tags, course_tags, software_tags, brand_preferences, priority_tags, intent_tags, confidence, signals_count, last_seen_at, expires_at, created_at, updated_at";
const TAG_PATTERN = /^[a-z0-9][a-z0-9:-]{0,63}$/;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,199}$/;

function databaseError(message: string, cause: unknown): AgentError {
  return new AgentError({
    code: "DATABASE_ERROR",
    message,
    retryable: true,
    cause,
  });
}

function boundedTags(values: readonly string[], limit: number): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()))]
    .filter((value) => TAG_PATTERN.test(value))
    .sort()
    .slice(0, limit);
}

function mergedTags(
  existing: readonly string[],
  current: readonly string[],
  limit: number
): string[] {
  return boundedTags([...existing, ...current], limit);
}

function mergedBrandPreferences(
  existing: readonly string[],
  current: readonly string[]
): string[] {
  const byBrand = new Map<string, string>();
  for (const value of boundedTags([...existing, ...current], 40)) {
    const [, brand] = value.split(":", 2);
    if (brand) byBrand.set(brand, value);
  }
  // Re-apply current values last because boundedTags sorts its input.
  for (const value of boundedTags(current, 20)) {
    const [, brand] = value.split(":", 2);
    if (brand) byBrand.set(brand, value);
  }
  return [...byBrand.values()].sort().slice(0, 20);
}

function boundedConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, Math.round(value * 1000) / 1000));
}

function expiryFromNow(days: number): string {
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: "Chip retention must be an integer between 1 and 3650 days.",
    });
  }
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function hashAnonymousSessionId(sessionId: string): string {
  if (!sessionId || sessionId.length > 500) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: "A valid anonymous chat session is required.",
    });
  }
  return createHash("sha256")
    .update("laptopfinder:chip-learning:v1\0", "utf8")
    .update(sessionId, "utf8")
    .digest("hex");
}

function normalizeProfile(
  row: Record<string, unknown>
): ChipSessionProfileRecord {
  return {
    ...(row as unknown as ChipSessionProfileRecord),
    confidence: boundedConfidence(Number(row.confidence ?? 0)),
    signals_count: Number(row.signals_count ?? 0),
    role_tags: boundedTags((row.role_tags as string[] | null) ?? [], 8),
    course_tags: boundedTags((row.course_tags as string[] | null) ?? [], 20),
    software_tags: boundedTags((row.software_tags as string[] | null) ?? [], 20),
    brand_preferences: boundedTags(
      (row.brand_preferences as string[] | null) ?? [],
      20
    ),
    priority_tags: boundedTags((row.priority_tags as string[] | null) ?? [], 20),
    intent_tags: boundedTags((row.intent_tags as string[] | null) ?? [], 20),
  };
}

export async function getChipSessionProfile(
  sessionId: string,
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<ChipSessionProfileRecord | null> {
  const { data, error } = await client
    .from("chip_session_profiles")
    .select(CHIP_PROFILE_SELECT)
    .eq("anonymous_session_hash", hashAnonymousSessionId(sessionId))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw databaseError("Could not read the Chip session profile.", error);
  return data
    ? normalizeProfile(data as unknown as Record<string, unknown>)
    : null;
}

/** Missing migrations or transient learning-store errors never block chat. */
export async function getChipSessionProfileBestEffort(
  sessionId: string,
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<ChipSessionProfileRecord | null> {
  try {
    return await getChipSessionProfile(sessionId, client);
  } catch {
    return null;
  }
}

function mergedProfileValues(
  previous: ChipSessionProfileRecord | null,
  signals: ChipPreferenceSignals
) {
  const hasNewBudget =
    signals.budgetMin !== null || signals.budgetMax !== null;
  const values = {
    budgetMin: hasNewBudget ? signals.budgetMin : previous?.budget_min ?? null,
    budgetMax: hasNewBudget ? signals.budgetMax : previous?.budget_max ?? null,
    roleTags: mergedTags(previous?.role_tags ?? [], signals.roleTags, 8),
    courseTags: mergedTags(previous?.course_tags ?? [], signals.courseTags, 20),
    softwareTags: mergedTags(
      previous?.software_tags ?? [],
      signals.softwareTags,
      20
    ),
    brandPreferences: mergedBrandPreferences(
      previous?.brand_preferences ?? [],
      signals.brandPreferences
    ),
    priorityTags: mergedTags(
      previous?.priority_tags ?? [],
      signals.priorityTags,
      20
    ),
    intentTags: mergedTags(previous?.intent_tags ?? [], signals.intentTags, 20),
  };

  const signalsCount =
    (values.budgetMin !== null || values.budgetMax !== null ? 1 : 0) +
    values.roleTags.length +
    values.courseTags.length +
    values.softwareTags.length +
    values.brandPreferences.length +
    values.priorityTags.length +
    values.intentTags.length;

  return {
    ...values,
    confidence: boundedConfidence(
      Math.max(previous?.confidence ?? 0, signals.confidence)
    ),
    signalsCount: Math.min(1000, signalsCount),
  };
}

export async function recordChipLearningTurn(
  input: RecordChipLearningTurnInput,
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<{ profile: ChipSessionProfileRecord | null; eventRecorded: boolean }> {
  if (
    !Number.isInteger(input.turnNumber) ||
    input.turnNumber < 1 ||
    input.turnNumber > 1000
  ) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: "Chip turn number must be an integer between 1 and 1000.",
    });
  }

  const sessionHash = hashAnonymousSessionId(input.sessionId);
  const previous =
    input.previousProfile !== undefined
      ? input.previousProfile
      : await getChipSessionProfile(input.sessionId, client);
  const sameDomainPrevious =
    previous?.domain === input.domain ? previous : null;
  const now = new Date().toISOString();
  let profile: ChipSessionProfileRecord | null = sameDomainPrevious;

  if (sameDomainPrevious || hasChipPreferenceSignals(input.profileSignals)) {
    const merged = mergedProfileValues(
      sameDomainPrevious,
      input.profileSignals
    );
    const { data, error } = await client
      .from("chip_session_profiles")
      .upsert(
        {
          anonymous_session_hash: sessionHash,
          domain: input.domain,
          budget_min: merged.budgetMin,
          budget_max: merged.budgetMax,
          role_tags: merged.roleTags,
          course_tags: merged.courseTags,
          software_tags: merged.softwareTags,
          brand_preferences: merged.brandPreferences,
          priority_tags: merged.priorityTags,
          intent_tags: merged.intentTags,
          confidence: merged.confidence,
          signals_count: merged.signalsCount,
          last_seen_at: now,
          expires_at: expiryFromNow(input.profileRetentionDays),
        },
        { onConflict: "anonymous_session_hash" }
      )
      .select(CHIP_PROFILE_SELECT)
      .single();

    if (error || !data) {
      throw databaseError("Could not update the Chip session profile.", error);
    }
    profile = normalizeProfile(data as unknown as Record<string, unknown>);
  }

  const recommendedSlugs = [...new Set(input.recommendedSlugs)]
    .map((slug) => slug.trim().toLowerCase())
    .filter((slug) => SLUG_PATTERN.test(slug))
    .slice(0, 3);
  const eventHasSignals = hasChipPreferenceSignals(input.eventSignals);
  if (!eventHasSignals && recommendedSlugs.length === 0) {
    return { profile, eventRecorded: false };
  }

  const eventSignals = input.eventSignals;
  const { error: eventError } = await client
    .from("chip_interaction_events")
    .upsert(
      {
        anonymous_session_hash: sessionHash,
        turn_number: input.turnNumber,
        event_type:
          recommendedSlugs.length > 0 ? "recommendation" : "preference_signal",
        domain: input.domain,
        budget_min: eventSignals.budgetMin,
        budget_max: eventSignals.budgetMax,
        role_tags: boundedTags(eventSignals.roleTags, 8),
        course_tags: boundedTags(eventSignals.courseTags, 20),
        software_tags: boundedTags(eventSignals.softwareTags, 20),
        brand_preferences: boundedTags(eventSignals.brandPreferences, 20),
        priority_tags: boundedTags(eventSignals.priorityTags, 20),
        intent_tags: boundedTags(eventSignals.intentTags, 20),
        recommended_slugs: recommendedSlugs,
        confidence: boundedConfidence(eventSignals.confidence),
        expires_at: expiryFromNow(input.eventRetentionDays),
      },
      {
        onConflict: "anonymous_session_hash,turn_number,event_type",
        ignoreDuplicates: true,
      }
    );

  if (eventError) {
    throw databaseError("Could not record the structured Chip event.", eventError);
  }

  return { profile, eventRecorded: true };
}

/** Missing migrations or transient learning-store errors never block chat. */
export async function recordChipLearningTurnBestEffort(
  input: RecordChipLearningTurnInput,
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<boolean> {
  try {
    await recordChipLearningTurn(input, client);
    return true;
  } catch {
    return false;
  }
}

export async function deleteExpiredChipLearningData(
  now: Date = new Date(),
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<{ eventsDeleted: number; profilesDeleted: number }> {
  if (Number.isNaN(now.getTime())) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: "A valid Chip retention cutoff is required.",
    });
  }
  const cutoff = now.toISOString();
  const [events, profiles] = await Promise.all([
    client
      .from("chip_interaction_events")
      .delete()
      .lte("expires_at", cutoff)
      .select("id"),
    client
      .from("chip_session_profiles")
      .delete()
      .lte("expires_at", cutoff)
      .select("id"),
  ]);

  if (events.error || profiles.error) {
    throw databaseError(
      "Could not delete expired Chip learning data.",
      events.error ?? profiles.error
    );
  }
  return {
    eventsDeleted: events.data?.length ?? 0,
    profilesDeleted: profiles.data?.length ?? 0,
  };
}

function readableTag(value: string): string {
  return value.replace(/^(?:prefer|avoid):/, "").replace(/-/g, " ");
}

/** Build a bounded, structured prompt fragment; no free-form user text. */
export function buildChipProfilePromptContext(
  profile: ChipSessionProfileRecord | null
): string | null {
  if (!profile || profile.expires_at <= new Date().toISOString()) return null;
  const lines: string[] = [];
  if (profile.budget_min !== null && profile.budget_max !== null) {
    lines.push(
      `Budget: INR ${profile.budget_min.toLocaleString("en-IN")} to INR ${profile.budget_max.toLocaleString("en-IN")}`
    );
  } else if (profile.budget_max !== null) {
    lines.push(`Budget ceiling: INR ${profile.budget_max.toLocaleString("en-IN")}`);
  } else if (profile.budget_min !== null) {
    lines.push(`Budget floor: INR ${profile.budget_min.toLocaleString("en-IN")}`);
  }

  const groups: Array<[string, readonly string[]]> = [
    ["Role", profile.role_tags],
    ["Course or field", profile.course_tags],
    ["Software", profile.software_tags],
    ["Priorities", profile.priority_tags],
    ["Intent", profile.intent_tags],
  ];
  for (const [label, values] of groups) {
    if (values.length) lines.push(`${label}: ${values.map(readableTag).join(", ")}`);
  }

  const preferred = profile.brand_preferences
    .filter((value) => value.startsWith("prefer:"))
    .map(readableTag);
  const avoided = profile.brand_preferences
    .filter((value) => value.startsWith("avoid:"))
    .map(readableTag);
  if (preferred.length) lines.push(`Preferred brands: ${preferred.join(", ")}`);
  if (avoided.length) lines.push(`Avoided brands: ${avoided.join(", ")}`);

  return lines.length ? lines.map((line) => `- ${line}`).join("\n").slice(0, 1200) : null;
}

export { countChipPreferenceSignals };
