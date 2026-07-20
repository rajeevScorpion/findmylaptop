import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue | undefined };

/** The ungenerated project database client, injectable in services and tests. */
export type GrowthAgentDatabaseClient = SupabaseClient;

export const AGENT_JOB_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export type AgentJobStatus = (typeof AGENT_JOB_STATUSES)[number];

export const KNOWN_AGENT_JOB_TYPES = [
  "research.calendar",
  "research.discover_laptops",
  "research.refresh_product_data",
  "research.score_candidates",
  "blog.discover_topics",
  "blog.generate_draft",
  "blog.schedule_approved_post",
  "chip.summarize_interactions",
  "chip.update_recommendation_rules",
  "monetization.resolve_affiliate_links",
  "analytics.generate_growth_insights",
] as const;

export type KnownAgentJobType = (typeof KNOWN_AGENT_JOB_TYPES)[number];
export type AgentJobType = KnownAgentJobType | (string & {});

export interface AgentSettingRow {
  id: string;
  key: string;
  value_json: JsonValue;
  description: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentSettingUpdate {
  key: string;
  value: JsonValue;
}

export interface GrowthAgentSettings {
  globalPause: boolean;
  emergencyStop: boolean;
  researchAgentEnabled: boolean;
  bloggingAgentEnabled: boolean;
  chipLearningEnabled: boolean;
  affiliateLinksEnabled: boolean;
  safeMode: boolean;
  retention: {
    rawProductPayloadsDays: number;
    chipInteractionEventsDays: number;
    anonymousSessionProfilesDays: number;
    chatTranscriptsDays: number;
    agentJobsDays: number;
    affiliateClickEventsDays: number;
    auditEventsDays: number;
  };
}

export type SourceAdapterMode = "api" | "manual" | "csv" | "feed";

export type SourceCredentialStatus =
  | "not_required"
  | "not_configured"
  | "unchecked"
  | "valid"
  | "invalid"
  | "error";

export interface SourceAdapterRecord {
  id: string;
  source_key: string;
  display_name: string;
  mode: SourceAdapterMode;
  enabled: boolean;
  credential_status: SourceCredentialStatus;
  freshness_ttl_minutes: number;
  public_display_allowed: boolean;
  requires_admin_approval: boolean;
  last_health_check_at: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentJobRecord {
  id: string;
  job_type: string;
  status: AgentJobStatus;
  idempotency_key: string;
  payload_json: JsonObject;
  result_json: JsonValue | null;
  error_code: string | null;
  error_message: string | null;
  attempt_count: number;
  max_attempts: number;
  scheduled_for: string;
  next_retry_at: string | null;
  lock_owner: string | null;
  lock_token: string | null;
  locked_at: string | null;
  lock_expires_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentJobInput {
  jobType: AgentJobType;
  idempotencyKey: string;
  payload?: JsonObject;
  maxAttempts?: number;
  scheduledFor?: string;
  createdBy?: string | null;
}

export interface CreateAgentJobResult {
  job: AgentJobRecord;
  created: boolean;
}

export interface ClaimAgentJobOptions {
  lockTtlSeconds?: number;
  now?: Date;
}

export interface FailAgentJobInput {
  code: string;
  message: string;
  retryable?: boolean;
  retryAt?: string;
}

export interface ListAgentJobsOptions {
  status?: AgentJobStatus;
  jobType?: string;
  before?: string;
  limit?: number;
}

export interface SourceAdapterUpdate {
  enabled?: boolean;
  freshnessTtlMinutes?: number;
  publicDisplayAllowed?: boolean;
  requiresAdminApproval?: boolean;
}
