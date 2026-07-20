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

export interface ListDispatchableAgentJobsOptions {
  jobType?: string;
  retryOnly?: boolean;
  limit?: number;
  now?: Date;
}

export interface ReclaimExpiredAgentJobsOptions {
  jobType?: string;
  limit?: number;
  now?: Date;
}

export interface ReclaimExpiredAgentJobsResult {
  inspected: number;
  requeued: number;
  failed: number;
  skipped: number;
}

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

export function isAgentJobDispatchable(
  job: AgentJobRecord,
  now = new Date()
): boolean {
  const nowTime = now.getTime();
  const scheduledTime = new Date(job.scheduled_for).getTime();
  const retryTime = job.next_retry_at
    ? new Date(job.next_retry_at).getTime()
    : null;
  return (
    job.status === "queued" &&
    job.attempt_count < job.max_attempts &&
    Number.isFinite(scheduledTime) &&
    scheduledTime <= nowTime &&
    (retryTime === null || (Number.isFinite(retryTime) && retryTime <= nowTime))
  );
}

/** List bounded queued work which is eligible at this poll instant. */
export async function listDispatchableAgentJobs(
  options: ListDispatchableAgentJobsOptions = {},
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<AgentJobRecord[]> {
  const limit = options.limit ?? 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: "Dispatch limit must be an integer between 1 and 100.",
    });
  }
  const now = (options.now ?? new Date()).toISOString();
  let query = client
    .from("agent_jobs")
    .select(AGENT_JOB_SELECT)
    .eq("status", "queued")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  // max_attempts cannot be compared to attempt_count through PostgREST's
  // column filter syntax, so the final bounded result is checked in memory.
  if (options.jobType) query = query.eq("job_type", options.jobType);
  if (options.retryOnly) {
    query = query.not("next_retry_at", "is", null).lte("next_retry_at", now);
  } else {
    query = query.or(`next_retry_at.is.null,next_retry_at.lte.${now}`);
  }

  const { data, error } = await query;
  if (error || !data) {
    throw databaseError("Could not list dispatchable growth-agent jobs.", error);
  }
  return (data as unknown as AgentJobRecord[]).filter((job) =>
    isAgentJobDispatchable(job, new Date(now))
  );
}

export function getExpiredLeaseRecovery(
  job: AgentJobRecord,
  now = new Date()
): { status: "queued" | "failed"; nextRetryAt: string | null; finishedAt: string | null } | null {
  const expiresAt = job.lock_expires_at
    ? new Date(job.lock_expires_at).getTime()
    : Number.NaN;
  if (
    job.status !== "running" ||
    !job.lock_token ||
    !Number.isFinite(expiresAt) ||
    expiresAt > now.getTime()
  ) {
    return null;
  }
  const exhausted = job.attempt_count >= job.max_attempts;
  return exhausted
    ? { status: "failed", nextRetryAt: null, finishedAt: now.toISOString() }
    : { status: "queued", nextRetryAt: now.toISOString(), finishedAt: null };
}

/**
 * Reclaim abandoned worker leases with lock-token and expiry preconditions.
 * The former worker can no longer complete a reclaimed job because its token
 * is cleared atomically. Exhausted jobs are terminal instead of looping.
 */
export async function reclaimExpiredAgentJobs(
  options: ReclaimExpiredAgentJobsOptions = {},
  client: GrowthAgentDatabaseClient = createAdminClient()
): Promise<ReclaimExpiredAgentJobsResult> {
  const limit = options.limit ?? 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AgentError({
      code: "VALIDATION_ERROR",
      message: "Lease recovery limit must be an integer between 1 and 100.",
    });
  }
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  let query = client
    .from("agent_jobs")
    .select(AGENT_JOB_SELECT)
    .eq("status", "running")
    .not("lock_expires_at", "is", null)
    .lte("lock_expires_at", nowIso)
    .order("lock_expires_at", { ascending: true })
    .limit(limit);
  if (options.jobType) query = query.eq("job_type", options.jobType);

  const { data, error } = await query;
  if (error || !data) {
    throw databaseError("Could not inspect expired growth-agent leases.", error);
  }

  const result: ReclaimExpiredAgentJobsResult = {
    inspected: data.length,
    requeued: 0,
    failed: 0,
    skipped: 0,
  };
  for (const row of data as unknown as AgentJobRecord[]) {
    const recovery = getExpiredLeaseRecovery(row, now);
    if (!recovery) {
      result.skipped += 1;
      continue;
    }
    if (row.job_type === "research.calendar") {
      const { data: outcome, error: recoveryError } = await client.rpc(
        "reclaim_research_calendar_lease",
        {
          p_agent_job_id: row.id,
          p_execution_token: row.lock_token!,
          p_expected_lock_expires_at: row.lock_expires_at!,
          p_now: nowIso,
        }
      );
      if (recoveryError) {
        throw databaseError(
          "Could not reclaim an expired research-calendar lease.",
          recoveryError
        );
      }
      if (outcome === "requeued") result.requeued += 1;
      else if (outcome === "failed") result.failed += 1;
      else result.skipped += 1;
      continue;
    }
    const { data: recovered, error: recoveryError } = await client
      .from("agent_jobs")
      .update({
        status: recovery.status,
        error_code: "WORKER_LEASE_EXPIRED",
        error_message: "The previous worker lease expired before completion.",
        next_retry_at: recovery.nextRetryAt,
        finished_at: recovery.finishedAt,
        lock_owner: null,
        lock_token: null,
        locked_at: null,
        lock_expires_at: null,
      })
      .eq("id", row.id)
      .eq("status", "running")
      .eq("lock_token", row.lock_token!)
      .eq("lock_expires_at", row.lock_expires_at!)
      .lte("lock_expires_at", nowIso)
      .select("id")
      .maybeSingle();
    if (recoveryError) {
      throw databaseError("Could not reclaim an expired growth-agent lease.", recoveryError);
    }
    if (!recovered) {
      result.skipped += 1;
    } else if (recovery.status === "queued") {
      result.requeued += 1;
    } else {
      result.failed += 1;
    }
  }
  return result;
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
    !isAgentJobDispatchable(current, now)
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
    .or(`next_retry_at.is.null,next_retry_at.lte.${lockedAt}`)
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
