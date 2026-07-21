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
  claimResearchNoveltyLease: vi.fn(),
  createResearchScheduleRun: vi.fn(),
  expireStaleResearchPackets: vi.fn(),
  finishResearchScheduleRun: vi.fn(),
  getResearchCalendarDay: vi.fn(),
  listDueResearchDays: vi.fn(),
  listRecentResearchSourceUses: vi.fn(),
  listResearchTopicHistory: vi.fn(),
  notifyResearchAdmin: vi.fn(),
  releaseResearchNoveltyLease: vi.fn(),
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
  claimResearchNoveltyLease: mocks.claimResearchNoveltyLease,
  createResearchScheduleRun: mocks.createResearchScheduleRun,
  expireStaleResearchPackets: mocks.expireStaleResearchPackets,
  finishResearchScheduleRun: mocks.finishResearchScheduleRun,
  getResearchCalendarDay: mocks.getResearchCalendarDay,
  listDueResearchDays: mocks.listDueResearchDays,
  listRecentResearchSourceUses: mocks.listRecentResearchSourceUses,
  listResearchTopicHistory: mocks.listResearchTopicHistory,
  notifyResearchAdmin: mocks.notifyResearchAdmin,
  releaseResearchNoveltyLease: mocks.releaseResearchNoveltyLease,
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
  novelty_window_days: 180,
  novelty_similarity_threshold: 62,
  source_rotation_enabled: true,
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

function generatedPacket(input: {
  title?: string;
  sourceUrl?: string;
  confidenceScore?: number;
} = {}) {
  const sourceUrl =
    input.sourceUrl ?? "https://www.intel.com/content/www/us/en/support/articles/000005511/processors.html";
  return {
    topicTitle:
      input.title ?? "How current Intel processor guidance affects laptop buyers",
    topicAngle:
      "Translate current official processor guidance into a practical laptop decision.",
    summary:
      "A sufficiently detailed evidence-backed summary for a deterministic research packet.",
    findings: [
      {
        title: "Official processor guidance",
        summary: "Current official guidance for laptop buyers.",
        evidence: "The official page documents the relevant processor guidance.",
        sourceUrl,
        sourceTitle: "Intel processor support",
        publishedAt: null,
        confidenceScore: input.confidenceScore ?? 92,
        timeSensitive: true,
      },
    ],
    suggestedPersonas: [],
    confidenceScore: input.confidenceScore ?? 92,
    urgency: "medium" as const,
    contentType: "hardware-trend" as const,
    monetizationIntent: "none" as const,
  };
}

function researchAgentResult(packets = [generatedPacket()]) {
  return {
    packets,
    candidatesEvaluated: packets.length,
    rejectionCounts: {},
    noGoodTopicCode: null,
    responseId: "response_novel_topic",
    model: "research-model",
    searchedSources: packets.flatMap((packet) =>
      packet.findings.map((finding) => finding.sourceUrl)
    ),
    noGoodTopicReason: null,
    usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
  };
}

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
      candidatesEvaluated: 0,
      rejectionCounts: { no_qualifying_candidate: 1 },
      noGoodTopicCode: "no_qualifying_candidate",
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
    mocks.claimResearchNoveltyLease.mockResolvedValue(true);
    mocks.releaseResearchNoveltyLease.mockResolvedValue(true);
    mocks.listResearchTopicHistory.mockResolvedValue([]);
    mocks.listRecentResearchSourceUses.mockResolvedValue([]);
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
    mocks.runResearchAgent.mockResolvedValue(researchAgentResult());
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

  it("persists deterministic novelty metadata for an accepted candidate", async () => {
    mocks.runResearchAgent.mockResolvedValue(researchAgentResult());
    mocks.saveResearchPackets.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000907",
        status: "ready_for_blog",
      },
    ]);

    const result = await pollResearchCalendar({ now, maxRuns: 1 });

    expect(mocks.saveResearchPackets).toHaveBeenCalledWith(
      expect.objectContaining({
        packets: [
          expect.objectContaining({
            topicFingerprint:
              "how current intel processor guidance affects laptop buyers",
            subjectKey: expect.stringMatching(/^[a-f0-9]{64}$/),
            noveltyScore: 100,
            nearestTopicSimilarity: null,
            noveltyWindowDays: 180,
            sourceDomains: ["intel.com"],
          }),
        ],
      })
    );
    expect(mocks.releaseResearchNoveltyLease).toHaveBeenCalledTimes(1);
    expect(mocks.finishResearchScheduleRun).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        status: "succeeded",
        packetsProduced: 1,
        result: expect.objectContaining({
          novelty: expect.objectContaining({ exactRaceDuplicates: 0 }),
          selectionSummary: expect.objectContaining({
            candidatesAccepted: 1,
          }),
        }),
      })
    );
    expect(result.runs[0]).toMatchObject({
      status: "succeeded",
      packetsProduced: 1,
    });
  });

  it("fails retryably without running the model when the novelty lease is busy", async () => {
    mocks.claimResearchNoveltyLease.mockResolvedValue(false);

    const result = await pollResearchCalendar({ now, maxRuns: 1 });

    expect(mocks.runResearchAgent).not.toHaveBeenCalled();
    expect(mocks.listResearchTopicHistory).not.toHaveBeenCalled();
    expect(mocks.releaseResearchNoveltyLease).not.toHaveBeenCalled();
    expect(mocks.failAgentJob).toHaveBeenCalledWith(
      retryJob.id,
      "00000000-0000-4000-8000-000000000902",
      expect.objectContaining({
        code: "RESEARCH_NOVELTY_BUSY",
        retryable: true,
      })
    );
    expect(result.runs[0]).toMatchObject({ status: "failed" });
  });

  it("releases the novelty lease and records a retryable failure when history cannot load", async () => {
    const historyError = new Error("History query timed out");
    (
      historyError as Error & { code?: string; retryable?: boolean }
    ).code = "ETIMEDOUT";
    (historyError as Error & { retryable?: boolean }).retryable = true;
    mocks.listResearchTopicHistory.mockRejectedValue(historyError);

    const result = await pollResearchCalendar({ now, maxRuns: 1 });

    expect(mocks.runResearchAgent).not.toHaveBeenCalled();
    expect(mocks.releaseResearchNoveltyLease).toHaveBeenCalledTimes(1);
    expect(mocks.failAgentJob).toHaveBeenCalledWith(
      retryJob.id,
      "00000000-0000-4000-8000-000000000902",
      expect.objectContaining({ code: "ETIMEDOUT", retryable: true })
    );
    expect(result.runs[0]).toMatchObject({ status: "failed" });
  });

  it("classifies an exact persistence race as a duplicate-topic outcome", async () => {
    mocks.runResearchAgent.mockResolvedValue(researchAgentResult());
    mocks.saveResearchPackets.mockResolvedValue([]);

    const result = await pollResearchCalendar({ now, maxRuns: 1 });

    expect(mocks.saveResearchPackets).toHaveBeenCalledWith(
      expect.objectContaining({ packets: [expect.any(Object)] })
    );
    expect(mocks.finishResearchScheduleRun).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        status: "no_good_topic",
        result: expect.objectContaining({
          outcomeReasonCode: "duplicate_topic",
          novelty: expect.objectContaining({ exactRaceDuplicates: 1 }),
          selectionSummary: expect.objectContaining({
            rejectionCounts: { duplicate_topic: 1 },
          }),
        }),
      })
    );
    expect(result.runs[0]).toMatchObject({
      status: "no_good_topic",
      reasonCode: "duplicate_topic",
      packetsProduced: 0,
    });
  });

  it("resumes durable packets without rerunning research after a lost persistence response", async () => {
    mocks.createResearchScheduleRun.mockResolvedValue({
      run: {
        id: "00000000-0000-4000-8000-000000000903",
        started_at: "2026-07-16T09:00:00.000Z",
        execution_token: "00000000-0000-4000-8000-000000000902",
        packets_persisted_at: "2026-07-16T09:00:10.000Z",
      },
      duplicate: false,
    });
    mocks.saveResearchPackets.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000908",
        status: "ready_for_blog",
        source_refs_json: [
          { url: "https://intel.com/recovered", title: "Intel" },
        ],
      },
    ]);

    const result = await pollResearchCalendar({ now, maxRuns: 1 });

    expect(mocks.listResearchTopicHistory).not.toHaveBeenCalled();
    expect(mocks.listRecentResearchSourceUses).not.toHaveBeenCalled();
    expect(mocks.runResearchAgent).not.toHaveBeenCalled();
    expect(mocks.saveResearchPackets).toHaveBeenCalledWith(
      expect.objectContaining({ packets: [] })
    );
    expect(mocks.releaseResearchNoveltyLease).toHaveBeenCalledTimes(1);
    expect(mocks.finishResearchScheduleRun).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        status: "succeeded",
        packetsProduced: 1,
        result: expect.objectContaining({
          model: "recovered-persisted-research-run",
          searchedSources: ["https://intel.com/recovered"],
          novelty: expect.objectContaining({
            historyItemsCompared: null,
            recoveredPersistedPackets: true,
            exactRaceDuplicates: 0,
          }),
        }),
      })
    );
    expect(result.runs[0]).toMatchObject({
      status: "succeeded",
      packetsProduced: 1,
    });
    expect(result.runs[0].message).toContain("Recovered 1 research packet");
  });

  it("records a repeated editorial topic as a no-topic outcome, not a duplicate execution", async () => {
    const repeatedTitle =
      "Adobe Illustrator requirements for design students before updating";
    const sourceUrl =
      "https://helpx.adobe.com/illustrator/technical-requirements.html";
    mocks.listResearchTopicHistory.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000905",
        kind: "research_packet",
        title: repeatedTitle,
        angle: "Explain Illustrator requirements for a student laptop.",
        summary: "Prior evidence-backed coverage of the same decision.",
        contentType: "software-guide",
        audiences: ["design students"],
        sourceUrls: [sourceUrl],
        createdAt: "2026-07-15T09:00:00.000Z",
        status: "used",
        calendarDayId: day.id,
        scheduleRunId: "00000000-0000-4000-8000-000000000906",
      },
    ]);
    mocks.runResearchAgent.mockResolvedValue({
      packets: [
        {
          topicTitle: `${repeatedTitle}!`,
          topicAngle: "Explain Illustrator requirements for a student laptop.",
          summary:
            "A sufficiently detailed evidence-backed summary of the repeated decision.",
          findings: [
            {
              title: "Illustrator requirements",
              summary: "Official system requirements.",
              evidence: "The official page lists current requirements.",
              sourceUrl,
              sourceTitle: "Adobe Illustrator requirements",
              publishedAt: null,
              confidenceScore: 94,
              timeSensitive: true,
            },
          ],
          suggestedPersonas: [],
          confidenceScore: 94,
          urgency: "medium",
          contentType: "software-guide",
          monetizationIntent: "none",
        },
      ],
      candidatesEvaluated: 1,
      rejectionCounts: {},
      noGoodTopicCode: null,
      noGoodTopicReason: null,
      responseId: "response_duplicate_topic",
      model: "research-model",
      searchedSources: [sourceUrl],
      usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
    });
    mocks.saveResearchPackets.mockResolvedValue([]);

    const result = await pollResearchCalendar({ now, maxRuns: 1 });

    expect(mocks.saveResearchPackets).toHaveBeenCalledWith(
      expect.objectContaining({ packets: [] })
    );
    expect(mocks.finishResearchScheduleRun).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        status: "no_good_topic",
        result: expect.objectContaining({
          outcomeReasonCode: "duplicate_topic",
          selectionSummary: expect.objectContaining({
            primaryReason: "duplicate_topic",
            candidatesAccepted: 0,
            rejectionCounts: { duplicate_topic: 1 },
          }),
        }),
      })
    );
    expect(result.runs[0]).toMatchObject({
      status: "no_good_topic",
      reasonCode: "duplicate_topic",
      packetsProduced: 0,
    });
    expect(result.runs[0].message).toContain("already covered recently");
  });
});
