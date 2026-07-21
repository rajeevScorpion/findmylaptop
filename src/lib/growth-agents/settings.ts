import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  AGENT_SETTING_KEYS,
  AGENT_SETTING_KEY_LIST,
  SAFE_AGENT_SETTINGS,
  SAFE_AGENT_SETTING_VALUES,
  isAgentSettingKey,
  validateAgentSettingValue,
  type AgentSettingKey,
} from "@/lib/growth-agents/defaults";
import { AgentError } from "@/lib/growth-agents/errors";
import type {
  AgentSettingRow,
  AgentSettingUpdate,
  GrowthAgentDatabaseClient,
  GrowthAgentSettings,
  JsonValue,
  SourceAdapterRecord,
  SourceCredentialStatus,
  SourceAdapterUpdate,
} from "@/lib/growth-agents/types";

const AGENT_SETTING_SELECT =
  "id, key, value_json, description, updated_by, created_at, updated_at";
const SOURCE_ADAPTER_SELECT =
  "id, source_key, display_name, mode, enabled, credential_status, freshness_ttl_minutes, public_display_allowed, requires_admin_approval, last_health_check_at, last_success_at, last_error_at, last_error_message, created_at, updated_at";

function databaseError(message: string, cause: unknown): AgentError {
  return new AgentError({
    code: "DATABASE_ERROR",
    message,
    retryable: true,
    cause,
  });
}
function safeSettingsCopy(): GrowthAgentSettings {
  return {
    ...SAFE_AGENT_SETTINGS,
    retention: { ...SAFE_AGENT_SETTINGS.retention },
  };
}

function resolvedValue(
  values: ReadonlyMap<AgentSettingKey, JsonValue>,
  key: AgentSettingKey
): JsonValue {
  const candidate = values.get(key) ?? SAFE_AGENT_SETTING_VALUES[key];
  try {
    return validateAgentSettingValue(key, candidate);
  } catch {
    return SAFE_AGENT_SETTING_VALUES[key];
  }
}

export function resolveAgentSettings(
  rows: readonly AgentSettingRow[]
): GrowthAgentSettings {
  const values = new Map<AgentSettingKey, JsonValue>();

  for (const row of rows) {
    if (isAgentSettingKey(row.key)) values.set(row.key, row.value_json);
  }

  return {
    globalPause: resolvedValue(
      values,
      AGENT_SETTING_KEYS.globalPause
    ) as boolean,
    emergencyStop: resolvedValue(
      values,
      AGENT_SETTING_KEYS.emergencyStop
    ) as boolean,
    researchAgentEnabled: resolvedValue(
      values,
      AGENT_SETTING_KEYS.researchAgentEnabled
    ) as boolean,
    bloggingAgentEnabled: resolvedValue(
      values,
      AGENT_SETTING_KEYS.bloggingAgentEnabled
    ) as boolean,
    chipLearningEnabled: resolvedValue(
      values,
      AGENT_SETTING_KEYS.chipLearningEnabled
    ) as boolean,
    affiliateLinksEnabled: resolvedValue(
      values,
      AGENT_SETTING_KEYS.affiliateLinksEnabled
    ) as boolean,
    safeMode: resolvedValue(values, AGENT_SETTING_KEYS.safeMode) as boolean,
    retention: {
      rawProductPayloadsDays: resolvedValue(
        values,
        AGENT_SETTING_KEYS.retentionRawProductPayloadsDays
      ) as number,
      chipInteractionEventsDays: resolvedValue(
        values,
        AGENT_SETTING_KEYS.retentionChipInteractionEventsDays
      ) as number,
      anonymousSessionProfilesDays: resolvedValue(
        values,
        AGENT_SETTING_KEYS.retentionAnonymousSessionProfilesDays
      ) as number,
      chatTranscriptsDays: resolvedValue(
        values,
        AGENT_SETTING_KEYS.retentionChatTranscriptsDays
      ) as number,
      agentJobsDays: resolvedValue(
        values,
        AGENT_SETTING_KEYS.retentionAgentJobsDays
      ) as number,
      affiliateClickEventsDays: resolvedValue(
        values,
        AGENT_SETTING_KEYS.retentionAffiliateClickEventsDays
      ) as number,
      auditEventsDays: resolvedValue(
        values,
        AGENT_SETTING_KEYS.retentionAuditEventsDays
      ) as number,
    },
  };
}

export async function listAgentSettingRows(
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<AgentSettingRow[]> {
  const { data, error } = await client
    .from("agent_settings")
    .select(AGENT_SETTING_SELECT)
    .in("key", [...AGENT_SETTING_KEY_LIST])
    .order("key", { ascending: true });

  if (error || !data) {
    throw databaseError("Could not read growth-agent settings.", error);
  }

  return data as unknown as AgentSettingRow[];
}

/**
 * Fail-closed runtime read. Call listAgentSettingRows directly in admin health
 * surfaces when a database error needs to be shown instead of hidden.
 */
export async function getAgentSettings(
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<GrowthAgentSettings> {
  try {
    return resolveAgentSettings(await listAgentSettingRows(client));
  } catch {
    return safeSettingsCopy();
  }
}

async function recordAuditEvent(
  client: GrowthAgentDatabaseClient,
  event: {
    eventType: string;
    actorIdentifier: string;
    entityType: string;
    entityId: string;
    summary: string;
    metadata: Record<string, JsonValue>;
  }
): Promise<void> {
  const { error } = await client.from("audit_events").insert({
    event_type: event.eventType,
    actor_type: "admin",
    actor_identifier: event.actorIdentifier,
    entity_type: event.entityType,
    entity_id: event.entityId,
    summary: event.summary,
    metadata_json: event.metadata,
  });

  // The mutation is already durable at this point. Keep the admin operation
  // usable while surfacing a scrubbed operational error to server logs.
  if (error) console.error("Growth-agent audit insert failed", error.code);
}

export async function updateAgentSettings(
  updates: readonly AgentSettingUpdate[],
  updatedBy: string,
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<AgentSettingRow[]> {
  if (updates.length < 1 || updates.length > AGENT_SETTING_KEY_LIST.length) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: `Provide between 1 and ${AGENT_SETTING_KEY_LIST.length} growth-agent setting updates.`,
    });
  }

  const rows = new Map<AgentSettingKey, JsonValue>();
  for (const update of updates) {
    if (!isAgentSettingKey(update.key)) {
      throw new AgentError({
        code: "VALIDATION_ERROR",
        message: `Unknown growth-agent setting: ${update.key}`,
        details: { key: update.key },
      });
    }
    rows.set(update.key, validateAgentSettingValue(update.key, update.value));
  }

  const { data, error } = await client
    .from("agent_settings")
    .upsert(
      [...rows].map(([key, value_json]) => ({
        key,
        value_json,
        updated_by: updatedBy,
      })),
      { onConflict: "key" }
    )
    .select(AGENT_SETTING_SELECT);

  if (error || !data) {
    throw databaseError("Could not update growth-agent settings.", error);
  }

  await recordAuditEvent(client, {
    eventType: "agent_settings.updated",
    actorIdentifier: updatedBy,
    entityType: "agent_settings",
    entityId: "global",
    summary: "Growth-agent settings updated.",
    metadata: { keys: [...rows.keys()] },
  });

  return data as unknown as AgentSettingRow[];
}

export async function listSourceAdapters(
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<SourceAdapterRecord[]> {
  const { data, error } = await client
    .from("source_adapters")
    .select(SOURCE_ADAPTER_SELECT)
    .order("source_key", { ascending: true });

  if (error || !data) {
    throw databaseError("Could not read source adapters.", error);
  }

  return data as unknown as SourceAdapterRecord[];
}

export async function recordSourceAdapterHealth(
  sourceKey: string,
  health: {
    credentialStatus: SourceCredentialStatus;
    checkedAt: string;
    message: string;
    runtimeEnabled: boolean;
  },
  checkedBy: string,
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<SourceAdapterRecord> {
  const failed =
    health.credentialStatus === "invalid" ||
    health.credentialStatus === "error" ||
    health.credentialStatus === "not_configured";
  const fields: Record<string, string | boolean | null> = {
    credential_status: health.credentialStatus,
    last_health_check_at: health.checkedAt,
  };
  if (health.credentialStatus === "valid" || health.credentialStatus === "not_required") {
    fields.last_success_at = health.checkedAt;
    fields.last_error_at = null;
    fields.last_error_message = null;
  } else if (failed) {
    fields.last_error_at = health.checkedAt;
    fields.last_error_message = health.message.slice(0, 1_000);
  }
  if (
    !health.runtimeEnabled ||
    health.credentialStatus === "invalid" ||
    health.credentialStatus === "not_configured"
  ) {
    fields.enabled = false;
  }

  const { data, error } = await client
    .from("source_adapters")
    .update(fields)
    .eq("source_key", sourceKey)
    .select(SOURCE_ADAPTER_SELECT)
    .single();
  if (error || !data) {
    throw databaseError("Could not record the source credential check.", error);
  }

  await recordAuditEvent(client, {
    eventType: "source_adapter.health_checked",
    actorIdentifier: checkedBy,
    entityType: "source_adapter",
    entityId: sourceKey,
    summary: "Source adapter credential health checked.",
    metadata: {
      credentialStatus: health.credentialStatus,
    },
  });

  return data as unknown as SourceAdapterRecord;
}

export async function updateSourceAdapter(
  sourceKey: string,
  update: SourceAdapterUpdate,
  updatedBy: string,
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<SourceAdapterRecord> {
  const fields: Record<string, boolean | number> = {};
  if (update.enabled !== undefined) fields.enabled = update.enabled;
  if (update.freshnessTtlMinutes !== undefined) {
    fields.freshness_ttl_minutes = update.freshnessTtlMinutes;
  }
  if (update.publicDisplayAllowed !== undefined) {
    fields.public_display_allowed = update.publicDisplayAllowed;
  }
  if (update.requiresAdminApproval !== undefined) {
    fields.requires_admin_approval = update.requiresAdminApproval;
  }

  if (Object.keys(fields).length === 0) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: "No source adapter changes were provided.",
    });
  }

  const { data: existing, error: existingError } = await client
    .from("source_adapters")
    .select("source_key, mode, credential_status")
    .eq("source_key", sourceKey)
    .maybeSingle();

  if (existingError) {
    throw databaseError("Could not read the source adapter.", existingError);
  }
  if (!existing) {
    throw new AgentError({
      code: "NOT_FOUND",
      message: "Source adapter not found.",
      details: { sourceKey },
    });
  }
  if (
    update.enabled === true &&
    existing.mode === "api" &&
    existing.credential_status !== "valid"
  ) {
    throw new AgentError({
      code: "CONFIGURATION_ERROR",
      message: "Validate this source's server-side credentials before enabling it.",
      details: { sourceKey },
    });
  }

  const { data, error } = await client
    .from("source_adapters")
    .update(fields)
    .eq("source_key", sourceKey)
    .select(SOURCE_ADAPTER_SELECT)
    .single();

  if (error || !data) {
    throw databaseError("Could not update the source adapter.", error);
  }

  await recordAuditEvent(client, {
    eventType: "source_adapter.updated",
    actorIdentifier: updatedBy,
    entityType: "source_adapter",
    entityId: sourceKey,
    summary: "Source adapter settings updated.",
    metadata: { fields: Object.keys(fields) },
  });

  return data as unknown as SourceAdapterRecord;
}
