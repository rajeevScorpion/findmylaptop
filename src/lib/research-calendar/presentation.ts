import type { ResearchSelectionReasonCode } from "./types";

type RunTone = "success" | "warning" | "error";

export interface ResearchRunPresentation {
  label: string;
  reasonLabel: string | null;
  detail: string | null;
  tone: RunTone;
}

const REASON_LABELS: Record<ResearchSelectionReasonCode, string> = {
  duplicate_topic: "Recently covered",
  insufficient_freshness: "Not current enough",
  insufficient_evidence: "Evidence too weak",
  source_rotation: "Source rotation",
  no_qualifying_candidate: "No qualifying candidate",
  source_configuration: "Source configuration",
};

const MIXED_REASON_LABELS: Record<ResearchSelectionReasonCode, string> = {
  duplicate_topic: "Some topics recently covered",
  insufficient_freshness: "Some topics not current enough",
  insufficient_evidence: "Some evidence too weak",
  source_rotation: "Some sources on cooldown",
  no_qualifying_candidate: "Some candidates did not qualify",
  source_configuration: "Some sources misconfigured",
};

const REJECTION_REASON_ORDER: ResearchSelectionReasonCode[] = [
  "duplicate_topic",
  "insufficient_evidence",
  "insufficient_freshness",
  "source_rotation",
  "source_configuration",
  "no_qualifying_candidate",
];

export interface ResearchPacketAuditPresentation {
  noveltyScoreLabel: string;
  nearestTopicKindLabel: string;
  nearestTopicTitleLabel: string;
  nearestTopicSimilarityLabel: string;
  sourceDomains: string[];
  sourceLinks: Array<{
    domain: string;
    title: string | null;
    url: string;
  }>;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function reasonCode(
  value: unknown
): ResearchSelectionReasonCode | null {
  const candidate = stringValue(value);
  return candidate && candidate in REASON_LABELS
    ? (candidate as ResearchSelectionReasonCode)
    : null;
}

function rejectionCount(value: unknown): number {
  const counts = record(value);
  if (!counts) return 0;
  return Object.values(counts).reduce<number>(
    (total, count) =>
      total + (typeof count === "number" && count > 0 ? count : 0),
    0
  );
}

function dominantRejectionReason(
  value: unknown
): ResearchSelectionReasonCode | null {
  const counts = record(value);
  if (!counts) return null;

  let selected: ResearchSelectionReasonCode | null = null;
  let selectedCount = 0;
  for (const reason of REJECTION_REASON_ORDER) {
    const count = counts[reason];
    if (typeof count === "number" && count > selectedCount) {
      selected = reason;
      selectedCount = count;
    }
  }
  return selected;
}

function percentageLabel(value: unknown, emptyLabel: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return emptyLabel;
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}%`;
}

function safeSourceLink(value: unknown): {
  domain: string;
  title: string | null;
  url: string;
} | null {
  const source = record(value);
  const rawUrl = stringValue(source?.url);
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return {
      domain: parsed.hostname.toLowerCase().replace(/^www\./, ""),
      title: stringValue(source?.title),
      url: parsed.toString(),
    };
  } catch {
    return null;
  }
}

export function researchPacketAuditPresentation(input: {
  noveltyScore?: unknown;
  nearestTopicSimilarity?: unknown;
  nearestTopicKind?: unknown;
  nearestTopicTitle?: unknown;
  sourceDomains?: unknown;
  sourceRefs?: unknown;
}): ResearchPacketAuditPresentation {
  const sourceLinks = Array.isArray(input.sourceRefs)
    ? input.sourceRefs
        .map(safeSourceLink)
        .filter((source): source is NonNullable<typeof source> => Boolean(source))
        .filter(
          (source, index, sources) =>
            sources.findIndex((candidate) => candidate.url === source.url) === index
        )
    : [];
  const recordedDomains = Array.isArray(input.sourceDomains)
    ? input.sourceDomains
        .map(stringValue)
        .filter((domain): domain is string => Boolean(domain))
        .map((domain) => domain.toLowerCase().replace(/^www\./, ""))
    : [];
  const sourceDomains = [...new Set([
    ...recordedDomains,
    ...sourceLinks.map((source) => source.domain),
  ])].sort((left, right) => left.localeCompare(right));
  const nearestKind = stringValue(input.nearestTopicKind);

  return {
    noveltyScoreLabel: percentageLabel(
      input.noveltyScore,
      "Not recorded (legacy packet)"
    ),
    nearestTopicKindLabel:
      nearestKind === "research_packet"
        ? "Research packet"
        : nearestKind === "blog_post"
          ? "Blog post"
          : "None recorded",
    nearestTopicTitleLabel:
      stringValue(input.nearestTopicTitle) ?? "None recorded",
    nearestTopicSimilarityLabel: percentageLabel(
      input.nearestTopicSimilarity,
      "None recorded"
    ),
    sourceDomains,
    sourceLinks,
  };
}

export function researchRunPresentation(input: {
  status: string;
  resultJson?: unknown;
  outcomeReasonCode?: unknown;
  errorMessage?: unknown;
  fallbackMessage?: unknown;
}): ResearchRunPresentation {
  const result = record(input.resultJson);
  const selection = record(result?.selectionSummary);
  const selectedReason =
    reasonCode(selection?.primaryReason) ??
    reasonCode(result?.outcomeReasonCode) ??
    reasonCode(input.outcomeReasonCode);
  const rejectionReason = dominantRejectionReason(selection?.rejectionCounts);
  const detail =
    stringValue(selection?.message) ??
    stringValue(result?.noGoodTopicReason) ??
    stringValue(input.errorMessage) ??
    stringValue(input.fallbackMessage);
  const hasRejections = rejectionCount(selection?.rejectionCounts) > 0;
  const isMixedOutcome =
    !selectedReason &&
    hasRejections &&
    (input.status === "succeeded" || input.status === "partial");

  const tone: RunTone =
    input.status === "failed" || input.status === "cancelled"
      ? "error"
      : input.status === "no_good_topic" ||
          input.status === "partial" ||
          input.status === "duplicate" ||
          input.status === "skipped" ||
          hasRejections
        ? "warning"
        : "success";

  return {
    label:
      input.status === "no_good_topic"
        ? "No new qualifying topic"
        : input.status === "duplicate"
          ? "Run already processed"
          : input.status.replaceAll("_", " "),
    reasonLabel: selectedReason
      ? REASON_LABELS[selectedReason]
      : isMixedOutcome && rejectionReason
        ? MIXED_REASON_LABELS[rejectionReason]
        : null,
    detail,
    tone,
  };
}
