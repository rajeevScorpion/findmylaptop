import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { deleteExpiredChipLearningData } from "@/lib/chip-learning/service";
import type { GrowthAgentSettings } from "./types";
import {
  RETENTION_AGENT_SETTING_KEYS,
  validateAgentSettingValue,
} from "./defaults";
import { listAgentSettingRows, resolveAgentSettings } from "./settings";

const CLEANUP_BATCH_SIZE = 500;
const CLEANUP_MAX_BATCHES = 10;

interface RetentionBatchResult {
  selected: number;
  affected: number;
}

export async function drainRetentionBatches(
  operation: () => Promise<RetentionBatchResult>,
  options: { batchSize?: number; maxBatches?: number } = {}
): Promise<{ affected: number; capacityReached: boolean }> {
  const batchSize = options.batchSize ?? CLEANUP_BATCH_SIZE;
  const maxBatches = options.maxBatches ?? CLEANUP_MAX_BATCHES;
  let affected = 0;
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const current = await operation();
    affected += current.affected;
    if (current.selected < batchSize) {
      return { affected, capacityReached: false };
    }
  }
  return { affected, capacityReached: true };
}

export interface RetentionCleanupResult {
  deletedAgentJobs: number;
  deletedAuditEvents: number;
  deletedAffiliateClicks: number;
  deletedChipEvents: number;
  deletedChipProfiles: number;
  deletedChatSessions: number;
  scrubbedCandidatePayloads: number;
  scrubbedOfferPayloads: number;
  errors: string[];
}

function cutoff(days: number, now: Date): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Best-effort cleanup: one missing optional migration never blocks other data. */
export async function runGrowthAgentRetentionCleanup(
  now = new Date()
): Promise<RetentionCleanupResult> {
  const result: RetentionCleanupResult = {
    deletedAgentJobs: 0,
    deletedAuditEvents: 0,
    deletedAffiliateClicks: 0,
    deletedChipEvents: 0,
    deletedChipProfiles: 0,
    deletedChatSessions: 0,
    scrubbedCandidatePayloads: 0,
    scrubbedOfferPayloads: 0,
    errors: [],
  };
  let settings: GrowthAgentSettings;
  try {
    // Destructive retention must never use fallback defaults. If configured
    // values cannot be read explicitly, skip the entire cleanup run.
    const settingRows = await listAgentSettingRows();
    const byKey = new Map(settingRows.map((row) => [row.key, row.value_json]));
    for (const key of RETENTION_AGENT_SETTING_KEYS) {
      if (!byKey.has(key)) throw new Error(`Missing retention setting: ${key}`);
      validateAgentSettingValue(key, byKey.get(key));
    }
    settings = resolveAgentSettings(settingRows);
  } catch {
    result.errors.push("settings_read_failed");
    return result;
  }
  const client = createAdminClient();

  const operations: Array<Promise<void>> = [
    (async () => {
      const before = cutoff(settings.retention.agentJobsDays, now);
      const drained = await drainRetentionBatches(async () => {
        const candidates = await client
          .from("agent_jobs")
          .select("id")
          .in("status", ["succeeded", "failed", "cancelled"])
          .lt("finished_at", before)
          .limit(CLEANUP_BATCH_SIZE);
        if (candidates.error) throw candidates.error;
        const ids = (candidates.data ?? []).map((row) => row.id as string);
        if (!ids.length) return { selected: 0, affected: 0 };
        const { data, error } = await client
          .from("agent_jobs")
          .delete()
          .in("id", ids)
          .in("status", ["succeeded", "failed", "cancelled"])
          .lt("finished_at", before)
          .select("id");
        if (error) throw error;
        return { selected: ids.length, affected: data?.length ?? 0 };
      });
      result.deletedAgentJobs = drained.affected;
      if (drained.capacityReached) result.errors.push("agent_jobs_capacity_reached");
    })(),
    (async () => {
      const before = cutoff(settings.retention.auditEventsDays, now);
      const drained = await drainRetentionBatches(async () => {
        const candidates = await client
          .from("audit_events")
          .select("id")
          .lt("created_at", before)
          .limit(CLEANUP_BATCH_SIZE);
        if (candidates.error) throw candidates.error;
        const ids = (candidates.data ?? []).map((row) => row.id as string);
        if (!ids.length) return { selected: 0, affected: 0 };
        const { data, error } = await client
          .from("audit_events")
          .delete()
          .in("id", ids)
          .lt("created_at", before)
          .select("id");
        if (error) throw error;
        return { selected: ids.length, affected: data?.length ?? 0 };
      });
      result.deletedAuditEvents = drained.affected;
      if (drained.capacityReached) result.errors.push("audit_events_capacity_reached");
    })(),
    (async () => {
      const before = cutoff(settings.retention.affiliateClickEventsDays, now);
      const drained = await drainRetentionBatches(async () => {
        const candidates = await client
          .from("affiliate_click_events")
          .select("id")
          .lt("clicked_at", before)
          .limit(CLEANUP_BATCH_SIZE);
        if (candidates.error) throw candidates.error;
        const ids = (candidates.data ?? []).map((row) => row.id as string);
        if (!ids.length) return { selected: 0, affected: 0 };
        const { data, error } = await client
          .from("affiliate_click_events")
          .delete()
          .in("id", ids)
          .lt("clicked_at", before)
          .select("id");
        if (error) throw error;
        return { selected: ids.length, affected: data?.length ?? 0 };
      });
      result.deletedAffiliateClicks = drained.affected;
      if (drained.capacityReached) {
        result.errors.push("affiliate_clicks_capacity_reached");
      }
    })(),
    (async () => {
      const chip = await deleteExpiredChipLearningData(now, client);
      result.deletedChipEvents = chip.eventsDeleted;
      result.deletedChipProfiles = chip.profilesDeleted;
      if (chip.eventsCapacityReached) result.errors.push("chip_events_capacity_reached");
      if (chip.profilesCapacityReached) {
        result.errors.push("chip_profiles_capacity_reached");
      }
    })(),
    (async () => {
      const before = cutoff(settings.retention.chatTranscriptsDays, now);
      const drained = await drainRetentionBatches(async () => {
        const candidates = await client
          .from("chat_sessions")
          .select("id")
          .lt("last_message_at", before)
          .limit(CLEANUP_BATCH_SIZE);
        if (candidates.error) throw candidates.error;
        const ids = (candidates.data ?? []).map((row) => row.id as string);
        if (!ids.length) return { selected: 0, affected: 0 };
        const { data, error } = await client
          .from("chat_sessions")
          .delete()
          .in("id", ids)
          .lt("last_message_at", before)
          .select("id");
        if (error) throw error;
        return { selected: ids.length, affected: data?.length ?? 0 };
      });
      result.deletedChatSessions = drained.affected;
      if (drained.capacityReached) result.errors.push("chat_sessions_capacity_reached");
    })(),
    (async () => {
      const before = cutoff(settings.retention.rawProductPayloadsDays, now);
      const drained = await drainRetentionBatches(async () => {
        const candidates = await client
          .from("product_candidates")
          .select("id")
          .lt("source_fetched_at", before)
          .neq("raw_payload_json", "{}")
          .limit(CLEANUP_BATCH_SIZE);
        if (candidates.error) throw candidates.error;
        const ids = (candidates.data ?? []).map((row) => row.id as string);
        if (!ids.length) return { selected: 0, affected: 0 };
        const { data, error } = await client
          .from("product_candidates")
          .update({ raw_payload_json: {} })
          .in("id", ids)
          .lt("source_fetched_at", before)
          .neq("raw_payload_json", "{}")
          .select("id");
        if (error) throw error;
        return { selected: ids.length, affected: data?.length ?? 0 };
      });
      result.scrubbedCandidatePayloads = drained.affected;
      if (drained.capacityReached) {
        result.errors.push("candidate_payloads_capacity_reached");
      }
    })(),
    (async () => {
      const before = cutoff(settings.retention.rawProductPayloadsDays, now);
      const drained = await drainRetentionBatches(async () => {
        const candidates = await client
          .from("product_offers")
          .select("id")
          .lt("source_fetched_at", before)
          .neq("raw_payload_json", "{}")
          .limit(CLEANUP_BATCH_SIZE);
        if (candidates.error) throw candidates.error;
        const ids = (candidates.data ?? []).map((row) => row.id as string);
        if (!ids.length) return { selected: 0, affected: 0 };
        const { data, error } = await client
          .from("product_offers")
          .update({ raw_payload_json: {} })
          .in("id", ids)
          .lt("source_fetched_at", before)
          .neq("raw_payload_json", "{}")
          .select("id");
        if (error) throw error;
        return { selected: ids.length, affected: data?.length ?? 0 };
      });
      result.scrubbedOfferPayloads = drained.affected;
      if (drained.capacityReached) result.errors.push("offer_payloads_capacity_reached");
    })(),
  ];

  const settled = await Promise.allSettled(operations);
  settled.forEach((operation, index) => {
    if (operation.status === "rejected") {
      result.errors.push(`cleanup_${index + 1}_failed`);
    }
  });
  return result;
}
