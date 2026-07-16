import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgentError } from "@/lib/growth-agents/errors";
import type {
  AgentJobRecord,
  ClaimAgentJobOptions,
  CreateAgentJobInput,
  CreateAgentJobResult,
  FailAgentJobInput,
  GrowthAgentDatabaseClient,
  JsonValue,
  ListAgentJobsOptions,
} from "@/lib/growth-agents/types";

const AGENT_JOB_SELECT =
  "id, job_type, status, idempotency_key, payload_json, result_json, error_code, error_message, attempt_count, max_attempts, scheduled_for, next_retry_at, lock_owner, lock_token, locked_at, lock_expires_at, started_at, finished_at, created_by, created_at, updated_at";

const JOB_TYPE_PATTERN = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/;

function databaseError(message: string, cause: unknown): AgentError {
  return new AgentError({
    code: "DATABASE_ERROR",
    message,
    retryable: true,
    cause,
  });
}

function parseDate(value: string, field: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: `${field} must be a valid ISO date-time.`,
      details: { field },
    });
  }
  return date.toISOString();
}

function validateCreateInput(input: CreateAgentJobInput): void {
  if (!JOB_TYPE_PATTERN.test(input.jobType) || input.jobType.length > 160) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: "jobType must be a namespaced growth-agent job type.",
    });
  }
  if (
    input.idempotencyKey.length < 1 ||
    input.idempotencyKey.length > 255
  ) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: "idempotencyKey must contain between 1 and 255 characters.",
    });
  }
  if (
    input.maxAttempts !== undefined &&
    (!Number.isInteger(input.maxAttempts) ||
      input.maxAttempts < 1 ||
      input.maxAttempts > 25)
  ) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: "maxAttempts must be an integer between 1 and 25.",
    });
  }
  if (input.scheduledFor) parseDate(input.scheduledFor, "scheduledFor");
}

export async function createAgentJob(
  input: CreateAgentJobInput,
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<CreateAgentJobResult> {
  validateCreateInput(input);

  const { data, error } = await client
    .from("agent_jobs")
    .insert({
      job_type: input.jobType,
      idempotency_key: input.idempotencyKey,
      payload_json: input.payload ?? {},
      max_attempts: input.maxAttempts ?? 3,
      scheduled_for: input.scheduledFor
        ? parseDate(input.scheduledFor, "scheduledFor")
        : new Date().toISOString(),
      created_by: input.createdBy ?? null,
    })
    .select(AGENT_JOB_SELECT)
    .single();

  if (!error && data) {
    return { job: data as unknown as AgentJobRecord, created: true };
  }

  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await client
      .from("agent_jobs")
      .select(AGENT_JOB_SELECT)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();

    if (!existingError && existing) {
      return {
        job: existing as unknown as AgentJobRecord,
        created: false,
      };
    }
  }

  throw databaseError("Could not create the growth-agent job.", error);
}

export async function getAgentJob(
  jobId: string,
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<AgentJobRecord | null> {
  const { data, error } = await client
    .from("agent_jobs")
    .select(AGENT_JOB_SELECT)
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw databaseError("Could not read the growth-agent job.", error);
  return data ? (data as unknown as AgentJobRecord) : null;
}

export async function listAgentJobs(
  options: ListAgentJobsOptions = {},
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<AgentJobRecord[]> {
  const limit = options.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: "Job list limit must be an integer between 1 and 100.",
    });
  }

  let query = client
    .from("agent_jobs")
    .select(AGENT_JOB_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.status) query = query.eq("status", options.status);
  if (options.jobType) query = query.eq("job_type", options.jobType);
  if (options.before) {
    query = query.lt("created_at", parseDate(options.before, "before"));
  }

  const { data, error } = await query;
  if (error || !data) {
    throw databaseError("Could not list growth-agent jobs.", error);
  }

  return data as unknown as AgentJobRecord[];
}

/**
 * Optimistically claim one known job. The conditional update is the durable
 * concurrency boundary; only one contender can move queued -> running.
 */
export async function claimAgentJob(
  jobId: string,
  lockOwner: string,
  options: ClaimAgentJobOptions = {},
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<AgentJobRecord | null> {
  const ttlSeconds = options.lockTtlSeconds ?? 1800;
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 86400) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: "Lock TTL must be an integer between 30 and 86400 seconds.",
    });
  }
  if (!lockOwner.trim() || lockOwner.length > 200) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: "lockOwner is required and may not exceed 200 characters.",
    });
  }

  const current = await getAgentJob(jobId, client);
  const now = options.now ?? new Date();
  if (
    !current ||
    current.status !== "queued" ||
    current.attempt_count >= current.max_attempts ||
    new Date(current.scheduled_for).getTime() > now.getTime()
  ) {
    return null;
  }

  const lockToken = randomUUID();
  const lockedAt = now.toISOString();
  const lockExpiresAt = new Date(
    now.getTime() + ttlSeconds * 1000
  ).toISOString();

  const { data, error } = await client
    .from("agent_jobs")
    .update({
      status: "running",
      attempt_count: current.attempt_count + 1,
      started_at: current.started_at ?? lockedAt,
      finished_at: null,
      next_retry_at: null,
      lock_owner: lockOwner,
      lock_token: lockToken,
      locked_at: lockedAt,
      lock_expires_at: lockExpiresAt,
    })
    .eq("id", jobId)
    .eq("status", "queued")
    .eq("attempt_count", current.attempt_count)
    .lte("scheduled_for", lockedAt)
    .select(AGENT_JOB_SELECT)
    .maybeSingle();

  if (error) throw databaseError("Could not claim the growth-agent job.", error);
  return data ? (data as unknown as AgentJobRecord) : null;
}

export async function completeAgentJob(
  jobId: string,
  lockToken: string,
  result: JsonValue,
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<AgentJobRecord> {
  const finishedAt = new Date().toISOString();
  const { data, error } = await client
    .from("agent_jobs")
    .update({
      status: "succeeded",
      result_json: result,
      error_code: null,
      error_message: null,
      next_retry_at: null,
      finished_at: finishedAt,
      lock_owner: null,
      lock_token: null,
      locked_at: null,
      lock_expires_at: null,
    })
    .eq("id", jobId)
    .eq("status", "running")
    .eq("lock_token", lockToken)
    .select(AGENT_JOB_SELECT)
    .maybeSingle();

  if (error) throw databaseError("Could not complete the growth-agent job.", error);
  if (!data) {
    throw new AgentError({
      code: "CONFLICT",
      message: "The job is no longer owned by this worker.",
    });
  }
  return data as unknown as AgentJobRecord;
}

export async function failAgentJob(
  jobId: string,
  lockToken: string,
  failure: FailAgentJobInput,
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<AgentJobRecord> {
  const current = await getAgentJob(jobId, client);
  if (
    !current ||
    current.status !== "running" ||
    current.lock_token !== lockToken
  ) {
    throw new AgentError({
      code: "CONFLICT",
      message: "The job is no longer owned by this worker.",
    });
  }

  const shouldRetry =
    failure.retryable === true && current.attempt_count < current.max_attempts;
  const retryAt = shouldRetry
    ? parseDate(
        failure.retryAt ??
          new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        "retryAt"
      )
    : null;

  const { data, error } = await client
    .from("agent_jobs")
    .update({
      status: shouldRetry ? "queued" : "failed",
      error_code: failure.code.slice(0, 120),
      error_message: failure.message.slice(0, 2000),
      next_retry_at: retryAt,
      scheduled_for: retryAt ?? current.scheduled_for,
      finished_at: shouldRetry ? null : new Date().toISOString(),
      lock_owner: null,
      lock_token: null,
      locked_at: null,
      lock_expires_at: null,
    })
    .eq("id", jobId)
    .eq("status", "running")
    .eq("lock_token", lockToken)
    .select(AGENT_JOB_SELECT)
    .maybeSingle();

  if (error) throw databaseError("Could not fail the growth-agent job.", error);
  if (!data) {
    throw new AgentError({
      code: "CONFLICT",
      message: "The job is no longer owned by this worker.",
    });
  }
  return data as unknown as AgentJobRecord;
}

export async function cancelAgentJob(
  jobId: string,
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<AgentJobRecord> {
  const { data, error } = await client
    .from("agent_jobs")
    .update({
      status: "cancelled",
      next_retry_at: null,
      finished_at: new Date().toISOString(),
      lock_owner: null,
      lock_token: null,
      locked_at: null,
      lock_expires_at: null,
    })
    .eq("id", jobId)
    .in("status", ["queued", "running"])
    .select(AGENT_JOB_SELECT)
    .maybeSingle();

  if (error) throw databaseError("Could not cancel the growth-agent job.", error);
  if (!data) {
    throw new AgentError({
      code: "CONFLICT",
      message: "Only queued or running jobs can be cancelled.",
    });
  }
  return data as unknown as AgentJobRecord;
}
