import { describe, expect, it } from "vitest";

import type { AgentJobRecord } from "./types";
import { getExpiredLeaseRecovery, isAgentJobDispatchable } from "./jobs";

function job(overrides: Partial<AgentJobRecord> = {}): AgentJobRecord {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    job_type: "research.calendar",
    status: "queued",
    idempotency_key: "job:research:day:2026-07-13",
    payload_json: {},
    result_json: null,
    error_code: null,
    error_message: null,
    attempt_count: 1,
    max_attempts: 3,
    scheduled_for: "2026-07-16T08:00:00.000Z",
    next_retry_at: null,
    lock_owner: null,
    lock_token: null,
    locked_at: null,
    lock_expires_at: null,
    started_at: null,
    finished_at: null,
    created_by: "cron",
    created_at: "2026-07-16T08:00:00.000Z",
    updated_at: "2026-07-16T08:00:00.000Z",
    ...overrides,
  };
}

describe("growth-agent job recovery", () => {
  const now = new Date("2026-07-16T09:00:00.000Z");

  it("does not dispatch a retry before next_retry_at", () => {
    expect(
      isAgentJobDispatchable(
        job({ next_retry_at: "2026-07-16T09:01:00.000Z" }),
        now
      )
    ).toBe(false);
    expect(
      isAgentJobDispatchable(
        job({ next_retry_at: "2026-07-16T09:00:00.000Z" }),
        now
      )
    ).toBe(true);
  });

  it("rejects terminal, future, and exhausted jobs", () => {
    expect(isAgentJobDispatchable(job({ status: "succeeded" }), now)).toBe(false);
    expect(
      isAgentJobDispatchable(
        job({ scheduled_for: "2026-07-16T09:01:00.000Z" }),
        now
      )
    ).toBe(false);
    expect(
      isAgentJobDispatchable(job({ attempt_count: 3, max_attempts: 3 }), now)
    ).toBe(false);
  });

  it("requeues an expired lease when attempts remain", () => {
    expect(
      getExpiredLeaseRecovery(
        job({
          status: "running",
          lock_token: "00000000-0000-4000-8000-000000000002",
          lock_expires_at: "2026-07-16T08:59:59.000Z",
        }),
        now
      )
    ).toEqual({
      status: "queued",
      nextRetryAt: "2026-07-16T09:00:00.000Z",
      finishedAt: null,
    });
  });

  it("fails an expired lease after the final attempt", () => {
    expect(
      getExpiredLeaseRecovery(
        job({
          status: "running",
          attempt_count: 3,
          max_attempts: 3,
          lock_token: "00000000-0000-4000-8000-000000000002",
          lock_expires_at: "2026-07-16T08:59:59.000Z",
        }),
        now
      )
    ).toEqual({
      status: "failed",
      nextRetryAt: null,
      finishedAt: "2026-07-16T09:00:00.000Z",
    });
  });

  it("does not reclaim a current lease", () => {
    expect(
      getExpiredLeaseRecovery(
        job({
          status: "running",
          lock_token: "00000000-0000-4000-8000-000000000002",
          lock_expires_at: "2026-07-16T09:00:01.000Z",
        }),
        now
      )
    ).toBeNull();
  });
});
