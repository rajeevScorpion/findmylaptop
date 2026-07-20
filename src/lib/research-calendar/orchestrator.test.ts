import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentJobRecord } from "@/lib/growth-agents/types";
import type { ResearchCalendar, ResearchCalendarDay } from "./types";

const mocks = vi.hoisted(() => ({
  claimAgentJob: vi.fn(),
  completeAgentJob: vi.fn(),
  createAgentJob: vi.fn(),
  failAgentJob: vi.fn(),
  listDispatchableAgentJobs: vi.fn(),
  reclaimExpiredAgentJobs: vi.fn(),
  getAgentSettings: vi.fn(),
  runResearchAgent: vi.fn(),
  createResearchScheduleRun: vi.fn(),
  expireStaleResearchPackets: vi.fn(),
  finishResearchScheduleRun: vi.fn(),
  getResearchCalendarDay: vi.fn(),
  listDueResearchDays: vi.fn(),
  notifyResearchAdmin: vi.fn(),
  saveResearchPackets: vi.fn(),
  countCreatedBlogAgentDraftsSince: vi.fn(),
  createBlogDraftFromResearchPacket: vi.fn(),
}));

vi.mock("@/lib/growth-agents/jobs", () => ({
  claimAgentJob: mocks.claimAgentJob,
  completeAgentJob: mocks.completeAgentJob,
  createAgentJob: mocks.createAgentJob,
  failAgentJob: mocks.failAgentJob,
  listDispatchableAgentJobs: mocks.listDispatchableAgentJobs,
  reclaimExpiredAgentJobs: mocks.reclaimExpiredAgentJobs,
}));
vi.mock("@/lib/growth-agents/settings", () => ({
  getAgentSettings: mocks.getAgentSettings,
}));
vi.mock("./research-agent", () => ({
  runResearchAgent: mocks.runResearchAgent,
}));
vi.mock("./service", () => ({
  createResearchScheduleRun: mocks.createResearchScheduleRun,
  expireStaleResearchPackets: mocks.expireStaleResearchPackets,
  finishResearchScheduleRun: mocks.finishResearchScheduleRun,
  getResearchCalendarDay: mocks.getResearchCalendarDay,
  listDueResearchDays: mocks.listDueResearchDays,
  notifyResearchAdmin: mocks.notifyResearchAdmin,
  saveResearchPackets: mocks.saveResearchPackets,
}));
vi.mock("@/lib/blog-agent/service", () => ({
  countCreatedBlogAgentDraftsSince: mocks.countCreatedBlogAgentDraftsSince,
  createBlogDraftFromResearchPacket: mocks.createBlogDraftFromResearchPacket,
}));

import { pollResearchCalendar } from "./orchestrator";

const calendar = {
  id: "00000000-0000-4000-8000-000000000026",
  enabled: true,
  paused: false,
  timezone: "Asia/Kolkata",
  max_posts_per_day: 2,
  max_posts_per_week: 7,
  max_auto_posts_per_day: 1,
  max_auto_posts_per_week: 1,
} as ResearchCalendar;

const day = {
  id: "00000000-0000-4000-8000-000000000261",
  calendar_id: calendar.id,
  enabled: true,
  theme_name: "Hardware trends",
  max_posts: 2,
} as ResearchCalendarDay;

const retryJob = {
  id: "00000000-0000-4000-8000-000000000901",
  job_type: "research.calendar",
  status: "queued",
  idempotency_key: `job:research:${day.id}:2026-07-13`,
  payload_json: {
    calendarId: calendar.id,
    calendarDayId: day.id,
    triggerType: "scheduled",
    scheduleDate: "2026-07-13",
    scheduledFor: "2026-07-13T03:30:00.000Z",
  },
  result_json: null,
  error_code: "SOURCE_UNAVAILABLE",
  error_message: "temporary failure",
  attempt_count: 1,
  max_attempts: 3,
  scheduled_for: "2026-07-16T08:55:00.000Z",
  next_retry_at: "2026-07-16T08:55:00.000Z",
  lock_owner: null,
  lock_token: null,
  locked_at: null,
  lock_expires_at: null,
  started_at: "2026-07-13T03:30:00.000Z",
  finished_at: null,
  created_by: "cron",
  created_at: "2026-07-13T03:30:00.000Z",
  updated_at: "2026-07-16T08:55:00.000Z",
} satisfies AgentJobRecord;

describe("research calendar polling", () => {
  const now = new Date("2026-07-16T09:00:00.000Z");

  beforeEach(() => {
    mocks.getAgentSettings.mockResolvedValue({
      emergencyStop: false,
      globalPause: false,
      researchAgentEnabled: true,
      bloggingAgentEnabled: false,
    });
    mocks.expireStaleResearchPackets.mockResolvedValue(0);
    mocks.reclaimExpiredAgentJobs.mockResolvedValue({
      inspected: 1,
      requeued: 1,
      failed: 0,
      skipped: 0,
    });
    mocks.listDispatchableAgentJobs.mockResolvedValue([retryJob]);
    mocks.getResearchCalendarDay.mockResolvedValue({ calendar, day });
    mocks.claimAgentJob.mockResolvedValue({
      ...retryJob,
      status: "running",
      attempt_count: 2,
      lock_token: "00000000-0000-4000-8000-000000000902",
    });
    mocks.createResearchScheduleRun.mockResolvedValue({
      run: {
        id: "00000000-0000-4000-8000-000000000903",
        started_at: "2026-07-16T09:00:00.000Z",
        execution_token: "00000000-0000-4000-8000-000000000902",
      },
      duplicate: false,
    });
    mocks.runResearchAgent.mockResolvedValue({
      packets: [],
      responseId: "response_1",
      model: "research-model",
      searchedSources: [],
      noGoodTopicReason: "No sufficiently supported topic.",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });
    mocks.saveResearchPackets.mockResolvedValue([]);
    mocks.finishResearchScheduleRun.mockResolvedValue(undefined);
    mocks.completeAgentJob.mockResolvedValue(undefined);
    mocks.notifyResearchAdmin.mockResolvedValue(undefined);
    mocks.listDueResearchDays.mockResolvedValue([
      {
        calendar,
        day,
        scheduleDate: "2026-07-16",
        scheduledFor: "2026-07-16T03:30:00.000Z",
      },
    ]);
  });

  it("drains a due retry before spending the bounded budget on new work", async () => {
    const result = await pollResearchCalendar({ now, maxRuns: 1 });

    expect(mocks.reclaimExpiredAgentJobs).toHaveBeenCalledWith({
      now,
      limit: 4,
    });
    expect(mocks.listDispatchableAgentJobs).toHaveBeenCalledWith({
      jobType: "research.calendar",
      retryOnly: false,
      limit: 1,
      now,
    });
    expect(mocks.createAgentJob).not.toHaveBeenCalled();
    expect(mocks.createResearchScheduleRun).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerType: "retry",
        scheduleDate: "2026-07-13",
        scheduledFor: "2026-07-13T03:30:00.000Z",
        idempotencyKey: `research:${day.id}:2026-07-13`,
      })
    );
    expect(mocks.runResearchAgent).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      retryableJobs: 1,
      queuedJobs: 1,
      dueDays: 1,
      recoveredLeases: { requeued: 1 },
      runs: [{ jobId: retryJob.id, status: "no_good_topic" }],
    });
  });

  it("treats cron retries as automatic and reports failed draft handoffs", async () => {
    mocks.getAgentSettings.mockResolvedValue({
      emergencyStop: false,
      globalPause: false,
      researchAgentEnabled: true,
      bloggingAgentEnabled: true,
    });
    mocks.saveResearchPackets.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000904",
        status: "ready_for_blog",
      },
    ]);
    mocks.countCreatedBlogAgentDraftsSince.mockResolvedValue(0);
    mocks.createBlogDraftFromResearchPacket.mockRejectedValue(
      new Error("Automatic persona is not permitted.")
    );

    const result = await pollResearchCalendar({ now, maxRuns: 1 });

    expect(mocks.createBlogDraftFromResearchPacket).toHaveBeenCalledWith(
      expect.objectContaining({
        automatic: true,
        agentJobLockToken: "00000000-0000-4000-8000-000000000902",
        researchExecutionToken: "00000000-0000-4000-8000-000000000902",
      })
    );
    expect(mocks.notifyResearchAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "research.blog_handoff_failed",
        severity: "warning",
      })
    );
    expect(result.runs[0]).toMatchObject({ status: "partial" });
  });
});
