import "server-only";

import { randomUUID } from "node:crypto";
import {
  countCreatedBlogAgentDraftsSince,
  createBlogDraftFromResearchPacket,
} from "@/lib/blog-agent/service";
import {
  claimAgentJob,
  completeAgentJob,
  createAgentJob,
  failAgentJob,
  listDispatchableAgentJobs,
  reclaimExpiredAgentJobs,
} from "@/lib/growth-agents/jobs";
import { getAgentSettings } from "@/lib/growth-agents/settings";
import type {
  AgentJobRecord,
  JsonObject,
} from "@/lib/growth-agents/types";
import { runResearchAgent } from "./research-agent";
import {
  getResearchNoveltyPolicy,
  selectNovelResearchPackets,
} from "./novelty";
import {
  claimResearchNoveltyLease,
  createResearchScheduleRun,
  expireStaleResearchPackets,
  finishResearchScheduleRun,
  getResearchCalendarDay,
  listDueResearchDays,
  listRecentResearchSourceUses,
  listResearchTopicHistory,
  notifyResearchAdmin,
  releaseResearchNoveltyLease,
  saveResearchPackets,
} from "./service";
import {
  buildScheduleIdempotencyKeyForDate,
  getZonedClock,
} from "./time";
import type {
  ResearchCalendar,
  ResearchCalendarDay,
  ResearchSelectionReasonCode,
  ResearchSelectionSummary,
} from "./types";

export interface ResearchRunOutcome {
  dayId: string;
  jobId: string | null;
  scheduleRunId: string | null;
  status:
    | "succeeded"
    | "partial"
    | "no_good_topic"
    | "duplicate"
    | "disabled"
    | "failed";
  packetsProduced: number;
  draftsProduced: number;
  message: string;
  reasonCode?: ResearchSelectionReasonCode | null;
  selectionSummary?: ResearchSelectionSummary | null;
}

export interface ResearchPollOutcome {
  expiredPackets: number;
  recoveredLeases: {
    inspected: number;
    requeued: number;
    failed: number;
    skipped: number;
  };
  queuedJobs: number;
  retryableJobs: number;
  dueDays: number;
  runs: ResearchRunOutcome[];
}

function operationalCode(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code.slice(0, 120);
  }
  return "research_run_failed";
}

function operationalMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 1_000)
    : "The research run failed.";
}

function isRetryable(error: unknown): boolean {
  if (error && typeof error === "object" && "retryable" in error) {
    return error.retryable === true;
  }
  return [
    "database_error",
    "SOURCE_RATE_LIMITED",
    "SOURCE_UNAVAILABLE",
    "LLM_GENERATION_FAILED",
    "RESEARCH_NOVELTY_BUSY",
  ].includes(operationalCode(error));
}

function disabledOutcome(dayId: string, message: string): ResearchRunOutcome {
  return {
    dayId,
    jobId: null,
    scheduleRunId: null,
    status: "disabled",
    packetsProduced: 0,
    draftsProduced: 0,
    message,
  };
}

const REASON_LABELS: Record<ResearchSelectionReasonCode, string> = {
  duplicate_topic: "recently covered",
  insufficient_freshness: "not current enough",
  insufficient_evidence: "insufficient evidence",
  source_rotation: "source rotation",
  no_qualifying_candidate: "no qualifying candidate",
  source_configuration: "source configuration",
};

function mergedRejectionCounts(
  ...counts: Array<Partial<Record<ResearchSelectionReasonCode, number>>>
): Partial<Record<ResearchSelectionReasonCode, number>> {
  const result: Partial<Record<ResearchSelectionReasonCode, number>> = {};
  for (const entry of counts) {
    for (const [reason, count] of Object.entries(entry) as Array<
      [ResearchSelectionReasonCode, number | undefined]
    >) {
      if (count && count > 0) result[reason] = (result[reason] ?? 0) + count;
    }
  }
  return result;
}

function selectionReason(input: {
  packetsAccepted: number;
  counts: Partial<Record<ResearchSelectionReasonCode, number>>;
  fallback: ResearchSelectionReasonCode | null;
}): ResearchSelectionReasonCode | null {
  if (input.packetsAccepted > 0) return null;
  const reasons = (Object.entries(input.counts) as Array<
    [ResearchSelectionReasonCode, number | undefined]
  >).filter(([, count]) => Boolean(count && count > 0));
  if (reasons.length === 1) return reasons[0][0];
  if (reasons.length > 1) return "no_qualifying_candidate";
  return input.fallback ?? "no_qualifying_candidate";
}

function noTopicMessage(input: {
  reason: ResearchSelectionReasonCode;
  modelReason: string | null;
  closestTitle: string | null;
  counts: Partial<Record<ResearchSelectionReasonCode, number>>;
}): string {
  if (input.reason === "duplicate_topic") {
    return input.closestTitle
      ? `No packet was created because the proposed topic was already covered recently: “${input.closestTitle}”.`
      : "No packet was created because the proposed topics repeated recent coverage or one another.";
  }
  if (input.reason === "source_rotation") {
    return (
      input.modelReason ??
      "No packet was created because every approved primary source is still inside the configured rotation window."
    );
  }
  if (input.reason === "source_configuration") {
    return (
      input.modelReason ??
      "No approved web source is configured for this calendar theme."
    );
  }
  if (input.reason === "insufficient_evidence") {
    return (
      input.modelReason ??
      "No proposed topic retained enough source-backed evidence to create a research packet."
    );
  }
  if (input.reason === "insufficient_freshness") {
    return (
      input.modelReason ??
      "The available official evidence was not current enough for a new research packet."
    );
  }
  const breakdown = (Object.entries(input.counts) as Array<
    [ResearchSelectionReasonCode, number | undefined]
  >)
    .filter(([, count]) => Boolean(count && count > 0))
    .map(([reason, count]) => `${count} ${REASON_LABELS[reason]}`)
    .join(", ");
  return (
    input.modelReason ??
    (breakdown
      ? `No packet was created after deterministic selection (${breakdown}).`
      : "No topic met the configured research and novelty thresholds.")
  );
}

async function notifyResearchAdminBestEffort(
  input: Parameters<typeof notifyResearchAdmin>[0]
): Promise<void> {
  try {
    await notifyResearchAdmin(input);
  } catch (error) {
    console.error(
      "Could not create research admin notification",
      operationalCode(error)
    );
  }
}

function scheduleExecutionKey(input: {
  day: ResearchCalendarDay;
  triggerType: "scheduled" | "manual" | "retry";
  scheduleDate: string;
}): string {
  const base = buildScheduleIdempotencyKeyForDate(
    input.day.id,
    input.scheduleDate
  );
  return input.triggerType === "manual"
    ? `${base}:manual:${randomUUID()}`
    : base;
}

/** Execute one bounded day through the durable agent_jobs lock. */
export async function runResearchCalendarDay(input: {
  calendar: ResearchCalendar;
  day: ResearchCalendarDay;
  triggerType: "scheduled" | "manual" | "retry";
  requestedBy: string;
  now?: Date;
  createBlogDrafts?: boolean;
  scheduleDate?: string;
  scheduledFor?: string;
  existingJob?: AgentJobRecord;
}): Promise<ResearchRunOutcome> {
  const now = input.now ?? new Date();
  const scheduleDate =
    input.scheduleDate ?? getZonedClock(now, input.calendar.timezone).dateKey;
  const scheduledFor = input.scheduledFor ?? now.toISOString();
  const settings = await getAgentSettings();
  if (settings.emergencyStop) {
    return disabledOutcome(input.day.id, "The emergency stop is active.");
  }
  if (settings.globalPause) {
    return disabledOutcome(input.day.id, "Growth agents are globally paused.");
  }
  if (!settings.researchAgentEnabled) {
    return disabledOutcome(input.day.id, "The Research Agent is disabled.");
  }
  if (!input.day.enabled) {
    return disabledOutcome(input.day.id, "This calendar day is disabled.");
  }
  if (
    input.triggerType !== "manual" &&
    (!input.calendar.enabled || input.calendar.paused)
  ) {
    return disabledOutcome(input.day.id, "The research calendar is not active.");
  }

  const executionKey = input.existingJob
    ? input.existingJob.idempotency_key.replace(/^job:/, "")
    : scheduleExecutionKey({
        day: input.day,
        triggerType: input.triggerType,
        scheduleDate,
      });
  const createdJob = input.existingJob
    ? { job: input.existingJob, created: false }
    : await createAgentJob({
        jobType: "research.calendar",
        idempotencyKey: `job:${executionKey}`,
        payload: {
          calendarId: input.calendar.id,
          calendarDayId: input.day.id,
          triggerType: input.triggerType,
          scheduleDate,
          scheduledFor,
        },
        maxAttempts: 3,
        scheduledFor,
        createdBy: input.requestedBy,
      });
  // Cron-dispatched retries are automatic even if the first attempt was
  // manually requested; they must never bypass automatic persona permissions.
  const automaticDraftHandoff = input.triggerType !== "manual";

  if (!createdJob.created && createdJob.job.status !== "queued") {
    return {
      dayId: input.day.id,
      jobId: createdJob.job.id,
      scheduleRunId: null,
      status: "duplicate",
      packetsProduced: 0,
      draftsProduced: 0,
      message: `A ${createdJob.job.status} run already exists for this schedule.`,
    };
  }

  const workerId = `research-calendar:${process.env.VERCEL_REGION ?? "local"}`;
  const claimedJob = await claimAgentJob(createdJob.job.id, workerId, {
    lockTtlSeconds: 1_800,
    now,
  });
  if (!claimedJob?.lock_token) {
    return {
      dayId: input.day.id,
      jobId: createdJob.job.id,
      scheduleRunId: null,
      status: "duplicate",
      packetsProduced: 0,
      draftsProduced: 0,
      message: "Another worker claimed this research run.",
    };
  }
  const researchExecutionToken = claimedJob.lock_token;

  let scheduleRunId: string | null = null;
  let scheduleRunStartedAt: string | null = null;
  try {
    const scheduleRun = await createResearchScheduleRun({
      calendar: input.calendar,
      day: input.day,
      triggerType: createdJob.created ? input.triggerType : "retry",
      scheduleDate,
      scheduledFor,
      idempotencyKey: executionKey,
      now,
      agentJobId: claimedJob.id,
      executionToken: claimedJob.lock_token,
    });
    scheduleRunId = scheduleRun.run.id;
    scheduleRunStartedAt = scheduleRun.run.started_at;

    if (scheduleRun.duplicate) {
      await completeAgentJob(claimedJob.id, claimedJob.lock_token, {
        status: "duplicate",
        scheduleRunId,
      });
      return {
        dayId: input.day.id,
        jobId: claimedJob.id,
        scheduleRunId,
        status: "duplicate",
        packetsProduced: 0,
        draftsProduced: 0,
        message: "This calendar day was already processed for the local date.",
      };
    }
    if (!scheduleRunStartedAt) {
      throw new Error("The research schedule run is missing its execution fence.");
    }
    if (scheduleRun.run.execution_token !== claimedJob.lock_token) {
      throw new Error("The research schedule run has a stale execution fence.");
    }

    const noveltyLeaseClaimed = await claimResearchNoveltyLease({
      runId: scheduleRunId,
      agentJobId: claimedJob.id,
      executionToken: researchExecutionToken,
      now,
    });
    if (!noveltyLeaseClaimed) {
      const error = new Error(
        "Another research run is finalizing deterministic topic selection. This run will retry after the novelty lease is available."
      );
      (error as Error & { code?: string; retryable?: boolean }).code =
        "RESEARCH_NOVELTY_BUSY";
      (error as Error & { retryable?: boolean }).retryable = true;
      throw error;
    }

    const selectionWork = await (async () => {
      try {
        const noveltyPolicy = getResearchNoveltyPolicy(input.calendar);
        if (scheduleRun.run.packets_persisted_at) {
          // Persistence is idempotent and may have committed even when the
          // caller lost the response. Resume from those durable rows instead
          // of attaching a second model call's unrelated audit trail.
          const packets = await saveResearchPackets({
            runId: scheduleRunId,
            agentJobId: claimedJob.id,
            executionToken: researchExecutionToken,
            day: input.day,
            packets: [],
            now,
          });
          const searchedSources = Array.from(
            new Set(
              packets.flatMap((packet) =>
                packet.source_refs_json.map((source) => source.url)
              )
            )
          );
          const noGoodTopicCode: ResearchSelectionReasonCode | null = packets.length
            ? null
            : "no_qualifying_candidate";
          const recoveryMessage = packets.length
            ? `Recovered ${packets.length} packet(s) persisted by the prior attempt.`
            : "The prior attempt already finalized a zero-packet selection. This retry resumed without running web research again.";
          return {
            noveltyPolicy,
            topicHistory: [],
            result: {
              packets: [],
              candidatesEvaluated: packets.length,
              rejectionCounts: {},
              noGoodTopicCode,
              noGoodTopicReason: packets.length ? null : recoveryMessage,
              responseId: "recovered-persisted-research-run",
              model: "recovered-persisted-research-run",
              searchedSources,
              usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            },
            noveltySelection: {
              packets: [],
              rejections: [],
              summary: {
                primaryReason: noGoodTopicCode,
                message: recoveryMessage,
                candidatesEvaluated: packets.length,
                candidatesAccepted: packets.length,
                rejectionCounts: {},
                historyWindowDays: noveltyPolicy.windowDays,
                similarityThreshold:
                  Math.round(noveltyPolicy.similarityThreshold * 10_000) / 100,
                closestDuplicate: null,
              },
            },
            packets,
            recoveredPersistedPackets: true,
          };
        }
        // A retry may see packets persisted by its own earlier leased attempt.
        // Excluding that run prevents self-rejection; the fenced persistence RPC
        // returns those existing packets when the retry resumes downstream work.
        const [loadedTopicHistory, sourceRotationUses] = await Promise.all([
          listResearchTopicHistory({
            now,
            windowDays: noveltyPolicy.windowDays,
            limit: 500,
          }),
          listRecentResearchSourceUses({
            calendarDayId: input.day.id,
            currentScheduleRunId: scheduleRunId,
            now,
            cooldownDays: noveltyPolicy.sourceCooldownDays,
            runLimit: noveltyPolicy.sourceCooldownRuns,
          }),
        ]);
        const topicHistory = loadedTopicHistory.filter(
          (topic) => topic.scheduleRunId !== scheduleRunId
        );
        const result = await runResearchAgent({
          calendar: input.calendar,
          day: input.day,
          topicHistory,
          sourceRotationUses,
          noveltyPolicy,
          now,
        });
        const noveltySelection = selectNovelResearchPackets({
          candidates: result.packets,
          references: topicHistory,
          audiences: input.day.target_audience,
          policy: noveltyPolicy,
          now,
        });
        const packets = await saveResearchPackets({
          runId: scheduleRunId,
          agentJobId: claimedJob.id,
          executionToken: researchExecutionToken,
          day: input.day,
          packets: noveltySelection.packets,
          now,
        });
        return {
          noveltyPolicy,
          topicHistory,
          result,
          noveltySelection,
          packets,
          recoveredPersistedPackets: false,
        };
      } finally {
        try {
          await releaseResearchNoveltyLease({
            runId: scheduleRunId,
            agentJobId: claimedJob.id,
            executionToken: researchExecutionToken,
          });
        } catch (releaseError) {
          console.error(
            "Could not release research novelty lease",
            operationalCode(releaseError)
          );
        }
      }
    })();
    const {
      noveltyPolicy,
      topicHistory,
      result,
      noveltySelection,
      packets,
      recoveredPersistedPackets,
    } = selectionWork;
    const exactRaceDuplicates = recoveredPersistedPackets
      ? 0
      : Math.max(0, noveltySelection.packets.length - packets.length);
    let draftsProduced = 0;
    const draftFailures: Array<{
      researchPacketId: string;
      code: string;
      message: string;
    }> = [];
    if (
      packets.length &&
      input.createBlogDrafts !== false &&
      settings.bloggingAgentEnabled
    ) {
      try {
        const [lastDay, lastWeek] = await Promise.all([
          countCreatedBlogAgentDraftsSince(
            new Date(now.getTime() - 24 * 60 * 60 * 1000)
          ),
          countCreatedBlogAgentDraftsSince(
            new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          ),
        ]);
        const dailyLimit =
          automaticDraftHandoff
            ? Math.min(
                input.calendar.max_posts_per_day,
                input.calendar.max_auto_posts_per_day
              )
            : input.calendar.max_posts_per_day;
        const weeklyLimit =
          automaticDraftHandoff
            ? Math.min(
                input.calendar.max_posts_per_week,
                input.calendar.max_auto_posts_per_week
              )
            : input.calendar.max_posts_per_week;
        const capacity = Math.max(
          0,
          Math.min(dailyLimit - lastDay, weeklyLimit - lastWeek, input.day.max_posts)
        );

        for (const packet of packets
          .filter((candidate) => candidate.status === "ready_for_blog")
          .slice(0, capacity)) {
          try {
            const draft = await createBlogDraftFromResearchPacket({
              researchPacketId: packet.id,
              requestedBy: input.requestedBy,
              agentJobId: claimedJob.id,
              agentJobLockToken: claimedJob.lock_token,
              researchExecutionToken: claimedJob.lock_token,
              automatic: automaticDraftHandoff,
            });
            if (draft.status === "needs_review") draftsProduced += 1;
            if (draft.status === "quality_blocked") {
              draftFailures.push({
                researchPacketId: packet.id,
                code: "quality_threshold_not_met",
                message: draft.message,
              });
            }
          } catch (draftError) {
            draftFailures.push({
              researchPacketId: packet.id,
              code: operationalCode(draftError),
              message: operationalMessage(draftError),
            });
          }
        }
      } catch (draftCapacityError) {
        draftFailures.push({
          researchPacketId: "capacity",
          code: operationalCode(draftCapacityError),
          message: operationalMessage(draftCapacityError),
        });
      }
    }
    const rejectionCounts = mergedRejectionCounts(
      result.rejectionCounts,
      noveltySelection.summary.rejectionCounts,
      exactRaceDuplicates ? { duplicate_topic: exactRaceDuplicates } : {}
    );
    const reasonCode = selectionReason({
      packetsAccepted: packets.length,
      counts: rejectionCounts,
      fallback: result.noGoodTopicCode,
    });
    const skippedCandidates = Object.values(rejectionCounts).reduce(
      (total, count) => total + (count ?? 0),
      0
    );
    const message = packets.length
      ? `${recoveredPersistedPackets ? "Recovered" : "Created"} ${packets.length} research packet(s) and ${draftsProduced} review draft(s).${
          skippedCandidates
            ? ` Skipped ${skippedCandidates} candidate(s) that did not pass deterministic selection.`
            : ""
        }`
      : noTopicMessage({
          reason: reasonCode ?? "no_qualifying_candidate",
          modelReason: result.noGoodTopicReason,
          closestTitle:
            noveltySelection.summary.closestDuplicate?.matchedTitle ?? null,
          counts: rejectionCounts,
        });
    const selectionSummary: ResearchSelectionSummary = {
      primaryReason: reasonCode,
      message,
      candidatesEvaluated: result.candidatesEvaluated,
      candidatesAccepted: packets.length,
      rejectionCounts,
      historyWindowDays: noveltyPolicy.windowDays,
      similarityThreshold: Math.round(
        noveltyPolicy.similarityThreshold * 10_000
      ) / 100,
      closestDuplicate: noveltySelection.summary.closestDuplicate,
    };
    const status = !packets.length
      ? "no_good_topic"
      : draftFailures.length
        ? "partial"
        : "succeeded";
    const resultJson: JsonObject = {
      status,
      responseId: result.responseId,
      model: result.model,
      packetsProduced: packets.length,
      draftsProduced,
      searchedSources: result.searchedSources,
      outcomeReasonCode: reasonCode,
      noGoodTopicReason: packets.length ? null : message,
      modelNoGoodTopicReason: result.noGoodTopicReason,
      selectionSummary: {
        primaryReason: selectionSummary.primaryReason,
        message: selectionSummary.message,
        candidatesEvaluated: selectionSummary.candidatesEvaluated,
        candidatesAccepted: selectionSummary.candidatesAccepted,
        rejectionCounts: selectionSummary.rejectionCounts,
        historyWindowDays: selectionSummary.historyWindowDays,
        similarityThreshold: selectionSummary.similarityThreshold,
        closestDuplicate: selectionSummary.closestDuplicate
          ? {
              candidateTitle:
                selectionSummary.closestDuplicate.candidateTitle,
              matchedTitle: selectionSummary.closestDuplicate.matchedTitle,
              similarityScore:
                selectionSummary.closestDuplicate.similarityScore,
              matchedKind: selectionSummary.closestDuplicate.matchedKind,
              matchedAt: selectionSummary.closestDuplicate.matchedAt,
            }
          : null,
      },
      novelty: {
        historyItemsCompared: recoveredPersistedPackets
          ? null
          : topicHistory.length,
        recoveredPersistedPackets,
        exactRaceDuplicates,
        rejections: noveltySelection.rejections.slice(0, 5).map((rejection) => ({
          reason: rejection.reason,
          candidateTitle: rejection.candidateTitle,
          matchedId: rejection.matchedId,
          matchedKind: rejection.matchedKind,
          matchedTitle: rejection.matchedTitle,
          similarityScore: rejection.similarityScore,
          metrics: {
            title: rejection.metrics.title,
            angle: rejection.metrics.angle,
            domain: rejection.metrics.domain,
            url: rejection.metrics.url,
            intent: rejection.metrics.intent,
            product: rejection.metrics.product,
            audience: rejection.metrics.audience,
            contentType: rejection.metrics.contentType,
            similarity: rejection.metrics.similarity,
          },
        })),
      },
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
      },
      draftFailures,
    };

    await finishResearchScheduleRun(scheduleRunId, {
      agentJobId: claimedJob.id,
      executionToken: claimedJob.lock_token,
      status,
      expectedStartedAt: scheduleRunStartedAt,
      packetsProduced: packets.length,
      draftsProduced,
      result: resultJson,
      sourceFailures: draftFailures,
    });
    await completeAgentJob(claimedJob.id, claimedJob.lock_token, resultJson);

    if (automaticDraftHandoff && draftFailures.length) {
      await notifyResearchAdminBestEffort({
        type: "research.blog_handoff_failed",
        severity: "warning",
        title: `Automatic draft handoff needs review: ${input.day.theme_name}`,
        message: `${draftFailures.length} research packet handoff(s) failed or did not meet the quality threshold.`,
        metadata: {
          calendarDayId: input.day.id,
          scheduleRunId,
          agentJobId: claimedJob.id,
          failures: draftFailures.map((failure) => ({
            researchPacketId: failure.researchPacketId,
            code: failure.code,
          })),
        },
      });
    }
    if (!packets.length) {
      await notifyResearchAdminBestEffort({
        type: "research.no_good_topic",
        severity: "warning",
        title: `No qualifying topic for ${input.day.theme_name}`,
        message:
          message,
        metadata: {
          calendarDayId: input.day.id,
          scheduleRunId,
          reasonCode,
          rejectionCounts,
        },
      });
    }

    return {
      dayId: input.day.id,
      jobId: claimedJob.id,
      scheduleRunId,
      status,
      packetsProduced: packets.length,
      draftsProduced,
      message,
      reasonCode,
      selectionSummary,
    };
  } catch (error) {
    const code = operationalCode(error);
    const message = operationalMessage(error);

    if (scheduleRunId && scheduleRunStartedAt) {
      try {
        await finishResearchScheduleRun(scheduleRunId, {
          agentJobId: claimedJob.id,
          executionToken: claimedJob.lock_token,
          status: "failed",
          expectedStartedAt: scheduleRunStartedAt,
          errorCode: code,
          errorMessage: message,
        });
      } catch (finishError) {
        console.error(
          "Could not finish failed research schedule run",
          operationalCode(finishError)
        );
      }
    }
    try {
      await failAgentJob(claimedJob.id, claimedJob.lock_token, {
        code,
        message,
        retryable: isRetryable(error),
      });
    } catch (jobError) {
      console.error(
        "Could not record failed research job",
        operationalCode(jobError)
      );
    }
    await notifyResearchAdminBestEffort({
      type: "research.failed",
      severity: "error",
      title: `Research run failed: ${input.day.theme_name}`,
      message,
      metadata: {
        calendarDayId: input.day.id,
        scheduleRunId,
        agentJobId: claimedJob.id,
        code,
      },
    });

    return {
      dayId: input.day.id,
      jobId: claimedJob.id,
      scheduleRunId,
      status: "failed",
      packetsProduced: 0,
      draftsProduced: 0,
      message,
    };
  }
}

export async function runResearchCalendarDayById(input: {
  calendarDayId: string;
  requestedBy: string;
  now?: Date;
  createBlogDrafts?: boolean;
}): Promise<ResearchRunOutcome> {
  const entry = await getResearchCalendarDay(input.calendarDayId);
  if (!entry) {
    return {
      dayId: input.calendarDayId,
      jobId: null,
      scheduleRunId: null,
      status: "failed",
      packetsProduced: 0,
      draftsProduced: 0,
      message: "Research calendar day not found.",
    };
  }
  return runResearchCalendarDay({
    ...entry,
    triggerType: "manual",
    requestedBy: input.requestedBy,
    now: input.now,
    createBlogDrafts: input.createBlogDrafts,
  });
}

function retryScheduleDate(job: AgentJobRecord): string | null {
  const payloadDate = job.payload_json.scheduleDate;
  if (
    typeof payloadDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(payloadDate)
  ) {
    return payloadDate;
  }
  return (
    job.idempotency_key.match(/:(\d{4}-\d{2}-\d{2})(?::|$)/)?.[1] ?? null
  );
}

function retryScheduledFor(job: AgentJobRecord): string {
  const payloadValue = job.payload_json.scheduledFor;
  if (
    typeof payloadValue === "string" &&
    Number.isFinite(new Date(payloadValue).getTime())
  ) {
    return new Date(payloadValue).toISOString();
  }
  return job.scheduled_for;
}

async function rejectMalformedResearchRetry(
  job: AgentJobRecord,
  now: Date,
  message: string
): Promise<ResearchRunOutcome> {
  const dayId =
    typeof job.payload_json.calendarDayId === "string"
      ? job.payload_json.calendarDayId
      : "unknown";
  const claimed = await claimAgentJob(
    job.id,
    `research-calendar-recovery:${process.env.VERCEL_REGION ?? "local"}`,
    { lockTtlSeconds: 300, now }
  );
  if (!claimed?.lock_token) {
    return {
      dayId,
      jobId: job.id,
      scheduleRunId: null,
      status: "duplicate",
      packetsProduced: 0,
      draftsProduced: 0,
      message: "Another worker claimed this retry.",
    };
  }
  await failAgentJob(claimed.id, claimed.lock_token, {
    code: "INVALID_RESEARCH_JOB_PAYLOAD",
    message,
    retryable: false,
  });
  await notifyResearchAdminBestEffort({
    type: "research.invalid_retry",
    severity: "error",
    title: "A queued research retry could not be recovered",
    message,
    metadata: { agentJobId: job.id, calendarDayId: dayId },
  });
  return {
    dayId,
    jobId: job.id,
    scheduleRunId: null,
    status: "failed",
    packetsProduced: 0,
    draftsProduced: 0,
    message,
  };
}

async function runQueuedResearchRetry(
  job: AgentJobRecord,
  now: Date
): Promise<ResearchRunOutcome> {
  const calendarDayId = job.payload_json.calendarDayId;
  const scheduleDate = retryScheduleDate(job);
  if (typeof calendarDayId !== "string" || !scheduleDate) {
    return rejectMalformedResearchRetry(
      job,
      now,
      "The queued research job is missing its calendar day or stable schedule date."
    );
  }
  const entry = await getResearchCalendarDay(calendarDayId);
  if (!entry) {
    return rejectMalformedResearchRetry(
      job,
      now,
      "The calendar day referenced by the queued research job no longer exists."
    );
  }
  return runResearchCalendarDay({
    ...entry,
    triggerType: "retry",
    requestedBy: "cron",
    now,
    createBlogDrafts: true,
    scheduleDate,
    scheduledFor: retryScheduledFor(job),
    existingJob: job,
  });
}

/** Poll due days. A low bound protects cron duration and model spend. */
export async function pollResearchCalendar(input: {
  now?: Date;
  maxRuns?: number;
} = {}): Promise<ResearchPollOutcome> {
  const now = input.now ?? new Date();
  const maxRuns = Math.min(Math.max(input.maxRuns ?? 3, 1), 7);
  const [settings, expiredPackets, recoveredLeases] = await Promise.all([
    getAgentSettings(),
    expireStaleResearchPackets(),
    reclaimExpiredAgentJobs({ now, limit: Math.min(maxRuns * 4, 100) }),
  ]);

  if (
    settings.emergencyStop ||
    settings.globalPause ||
    !settings.researchAgentEnabled
  ) {
    return {
      expiredPackets,
      recoveredLeases,
      queuedJobs: 0,
      retryableJobs: 0,
      dueDays: 0,
      runs: [],
    };
  }

  const runs: ResearchRunOutcome[] = [];
  const dispatchable = await listDispatchableAgentJobs({
    jobType: "research.calendar",
    retryOnly: false,
    limit: maxRuns,
    now,
  });
  for (const job of dispatchable) {
    runs.push(await runQueuedResearchRetry(job, now));
  }

  const due = await listDueResearchDays(now);
  const remainingRuns = Math.max(0, maxRuns - runs.length);
  for (const entry of due.slice(0, remainingRuns)) {
    runs.push(
      await runResearchCalendarDay({
        calendar: entry.calendar,
        day: entry.day,
        triggerType: "scheduled",
        requestedBy: "cron",
        now,
        createBlogDrafts: true,
        scheduleDate: entry.scheduleDate,
        scheduledFor: entry.scheduledFor,
      })
    );
  }
  return {
    expiredPackets,
    recoveredLeases,
    queuedJobs: dispatchable.length,
    retryableJobs: dispatchable.filter((job) => job.next_retry_at !== null)
      .length,
    dueDays: due.length,
    runs,
  };
}
