import "server-only";

import { AgentError } from "@/lib/growth-agents/errors";
import type { GrowthAgentSettings, JsonValue } from "@/lib/growth-agents/types";

export const AGENT_SETTING_KEYS = {
  globalPause: "global_pause",
  emergencyStop: "emergency_stop",
  researchAgentEnabled: "research_agent_enabled",
  bloggingAgentEnabled: "blogging_agent_enabled",
  chipLearningEnabled: "chip_learning_enabled",
  affiliateLinksEnabled: "affiliate_links_enabled",
  safeMode: "safe_mode",
  retentionRawProductPayloadsDays: "retention_raw_product_payloads_days",
  retentionChipInteractionEventsDays: "retention_chip_interaction_events_days",
  retentionAnonymousSessionProfilesDays:
    "retention_anonymous_session_profiles_days",
  retentionAgentJobsDays: "retention_agent_jobs_days",
  retentionAffiliateClickEventsDays: "retention_affiliate_click_events_days",
  retentionAuditEventsDays: "retention_audit_events_days",
} as const;

export type AgentSettingKey =
  (typeof AGENT_SETTING_KEYS)[keyof typeof AGENT_SETTING_KEYS];

export const AGENT_SETTING_KEY_LIST = Object.freeze(
  Object.values(AGENT_SETTING_KEYS)
) as readonly AgentSettingKey[];

export const BOOLEAN_AGENT_SETTING_KEYS = new Set<AgentSettingKey>([
  AGENT_SETTING_KEYS.globalPause,
  AGENT_SETTING_KEYS.emergencyStop,
  AGENT_SETTING_KEYS.researchAgentEnabled,
  AGENT_SETTING_KEYS.bloggingAgentEnabled,
  AGENT_SETTING_KEYS.chipLearningEnabled,
  AGENT_SETTING_KEYS.affiliateLinksEnabled,
  AGENT_SETTING_KEYS.safeMode,
]);

export const RETENTION_AGENT_SETTING_KEYS = new Set<AgentSettingKey>([
  AGENT_SETTING_KEYS.retentionRawProductPayloadsDays,
  AGENT_SETTING_KEYS.retentionChipInteractionEventsDays,
  AGENT_SETTING_KEYS.retentionAnonymousSessionProfilesDays,
  AGENT_SETTING_KEYS.retentionAgentJobsDays,
  AGENT_SETTING_KEYS.retentionAffiliateClickEventsDays,
  AGENT_SETTING_KEYS.retentionAuditEventsDays,
]);

export const SAFE_AGENT_SETTING_VALUES = Object.freeze({
  [AGENT_SETTING_KEYS.globalPause]: false,
  [AGENT_SETTING_KEYS.emergencyStop]: false,
  [AGENT_SETTING_KEYS.researchAgentEnabled]: false,
  [AGENT_SETTING_KEYS.bloggingAgentEnabled]: false,
  [AGENT_SETTING_KEYS.chipLearningEnabled]: false,
  [AGENT_SETTING_KEYS.affiliateLinksEnabled]: false,
  [AGENT_SETTING_KEYS.safeMode]: true,
  [AGENT_SETTING_KEYS.retentionRawProductPayloadsDays]: 30,
  [AGENT_SETTING_KEYS.retentionChipInteractionEventsDays]: 90,
  [AGENT_SETTING_KEYS.retentionAnonymousSessionProfilesDays]: 90,
  [AGENT_SETTING_KEYS.retentionAgentJobsDays]: 365,
  [AGENT_SETTING_KEYS.retentionAffiliateClickEventsDays]: 365,
  [AGENT_SETTING_KEYS.retentionAuditEventsDays]: 365,
}) satisfies Readonly<Record<AgentSettingKey, JsonValue>>;

export const SAFE_AGENT_SETTINGS: Readonly<GrowthAgentSettings> = Object.freeze({
  globalPause: false,
  emergencyStop: false,
  researchAgentEnabled: false,
  bloggingAgentEnabled: false,
  chipLearningEnabled: false,
  affiliateLinksEnabled: false,
  safeMode: true,
  retention: Object.freeze({
    rawProductPayloadsDays: 30,
    chipInteractionEventsDays: 90,
    anonymousSessionProfilesDays: 90,
    agentJobsDays: 365,
    affiliateClickEventsDays: 365,
    auditEventsDays: 365,
  }),
});

const agentSettingKeySet = new Set<string>(AGENT_SETTING_KEY_LIST);

export function isAgentSettingKey(key: string): key is AgentSettingKey {
  return agentSettingKeySet.has(key);
}
export function validateAgentSettingValue(
  key: AgentSettingKey,
  value: unknown
): JsonValue {
  if (BOOLEAN_AGENT_SETTING_KEYS.has(key)) {
    if (typeof value === "boolean") return value;
  } else if (RETENTION_AGENT_SETTING_KEYS.has(key)) {
    if (Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 3650) {
      return Number(value);
    }
  }

  throw new AgentError({
    code: "VALIDATION_ERROR",
    message: `Invalid value for growth-agent setting: ${key}`,
    details: { key },
  });
}
