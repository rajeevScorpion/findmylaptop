import { createHash } from "node:crypto";

import type {
  GeneratedResearchPacket,
  ResearchCalendar,
  ResearchHistoryKind,
  ResearchSelectionReasonCode,
  ResearchSelectionSummary,
} from "./types";

export interface ResearchNoveltyPolicy {
  windowDays: number;
  similarityThreshold: number;
  sourceRotationEnabled: boolean;
  sourceCooldownDays: number;
  sourceCooldownRuns: number;
}

export const DEFAULT_RESEARCH_NOVELTY_POLICY: ResearchNoveltyPolicy = {
  windowDays: 180,
  similarityThreshold: 0.62,
  sourceRotationEnabled: true,
  sourceCooldownDays: 14,
  sourceCooldownRuns: 2,
};

export type NoveltyReferenceKind =
  | "research_packet"
  | "blog_post"
  | "current_batch";

export interface NoveltyTopic {
  id?: string;
  kind?: NoveltyReferenceKind;
  title: string;
  angle?: string | null;
  summary?: string | null;
  contentType?: string | null;
  audiences?: readonly string[];
  sourceUrls?: readonly string[];
  confidenceScore?: number | null;
  createdAt?: string | null;
  status?: string | null;
}

export interface NoveltyReference extends NoveltyTopic {
  id: string;
  kind: ResearchHistoryKind;
  createdAt: string;
  calendarDayId?: string | null;
  scheduleRunId?: string | null;
}

export interface TopicNoveltyFeatures {
  exactTitleFingerprint: string;
  topicFingerprint: string;
  subjectKey: string;
  titleTokens: string[];
  bodyTokens: string[];
  primaryDomain: string | null;
  primaryDomainShare: number;
  domains: string[];
  canonicalUrls: string[];
  products: string[];
  intents: string[];
  audiences: string[];
  contentType: string | null;
}

export interface TopicNoveltyMetrics {
  title: number;
  angle: number;
  domain: number;
  url: number;
  intent: number;
  product: number;
  audience: number;
  contentType: number;
  similarity: number;
}

export type TopicNoveltyReason =
  | "novel"
  | "exact_title"
  | "exact_topic"
  | "similar_topic";

export interface TopicNoveltyEvaluation {
  novel: boolean;
  reason: TopicNoveltyReason;
  candidate: NoveltyTopic;
  matchedReference: NoveltyTopic | null;
  metrics: TopicNoveltyMetrics | null;
}

export interface TopicNoveltyBatchResult {
  accepted: NoveltyTopic[];
  rejected: TopicNoveltyEvaluation[];
  evaluations: TopicNoveltyEvaluation[];
}

export interface NovelResearchPacket {
  packet: GeneratedResearchPacket;
  topicFingerprint: string;
  subjectKey: string;
  noveltyScore: number;
  nearestTopicSimilarity: number | null;
  nearestTopicKind: ResearchHistoryKind | null;
  nearestTopicId: string | null;
  nearestTopicTitle: string | null;
  noveltyWindowDays: number;
  noveltyCheckedAt: string;
  sourceDomains: string[];
}

export interface NoveltyRejection {
  reason: Extract<ResearchSelectionReasonCode, "duplicate_topic">;
  candidateTitle: string;
  matchedId: string;
  matchedKind: NoveltyReferenceKind;
  matchedTitle: string;
  similarityScore: number;
  metrics: TopicNoveltyMetrics;
}

export interface NoveltySelectionResult {
  packets: NovelResearchPacket[];
  rejections: NoveltyRejection[];
  summary: ResearchSelectionSummary;
}

export interface SourceRotationUse {
  runId: string;
  usedAt: string;
  sourceUrls: readonly string[];
}

export interface SourceCooldownResult {
  allowedDomains: string[];
  cooledDomains: string[];
}

const DAY_MS = 24 * 60 * 60 * 1_000;
const REJECTED_HISTORY_DAYS = 30;
const PRIMARY_SOURCE_MIN_SHARE = 0.5;

const GENERIC_SOURCE_TOKENS = new Set([
  "article",
  "basic",
  "cloud",
  "content",
  "current",
  "desktop",
  "documentation",
  "download",
  "guide",
  "hardware",
  "help",
  "home",
  "index",
  "information",
  "latest",
  "learn",
  "product",
  "release",
  "requirement",
  "software",
  "support",
  "system",
  "technical",
  "view",
]);

const TRACKING_QUERY_KEYS = new Set([
  "clearcache",
  "fbclid",
  "gclid",
  "linkid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_",
]);

// Country-code registries commonly place organizations below a generic
// second-level label (for example, vendor.com.mx or vendor.co.za). Keeping the
// label list separate avoids treating every country-code hostname as three
// labels while covering the official vendor domains research agents use.
const COUNTRY_CODE_SECOND_LEVEL_LABELS = new Set([
  "ac",
  "co",
  "com",
  "edu",
  "gov",
  "net",
  "org",
]);

const STOP_WORDS = new Set(
  [
    "a",
    "an",
    "and",
    "are",
    "article",
    "as",
    "at",
    "be",
    "before",
    "best",
    "but",
    "buy",
    "buying",
    "by",
    "can",
    "current",
    "do",
    "does",
    "for",
    "from",
    "guide",
    "how",
    "in",
    "into",
    "is",
    "it",
    "its",
    "laptop",
    "laptops",
    "need",
    "needs",
    "not",
    "of",
    "on",
    "only",
    "or",
    "our",
    "should",
    "than",
    "that",
    "the",
    "their",
    "these",
    "this",
    "to",
    "what",
    "when",
    "where",
    "which",
    "while",
    "who",
    "why",
    "will",
    "with",
    "without",
    "your",
  ].map((word) => word.toLowerCase())
);

const PHRASE_ALIASES: Array<[RegExp, string]> = [
  [/\bcreative\s+cloud\b/g, " creativecloud "],
  [/\bpremiere\s+pro\b/g, " premiere "],
  [/\bafter\s+effects\b/g, " aftereffects "],
  [/\bandroid\s+studio\b/g, " androidstudio "],
  [/\bdesign\s+students?\b/g, " designstudent "],
  [/\bvideo\s+(?:editing\s+)?students?\b/g, " videostudent "],
  [/\bsystem\s+requirements?\b/g, " requirement "],
  [/\btechnical\s+requirements?\b/g, " requirement "],
  [/\boperating\s+systems?\b/g, " operatingsystem "],
  [/\bpre[\s-]+purchase\b/g, " prepurchase "],
  [/\bpre[\s-]+update\b/g, " preupdate "],
];

const PRODUCT_PATTERNS: Array<[string, RegExp]> = [
  ["creativecloud", /\bcreative\s*cloud\b/],
  ["illustrator", /\billustrator\b/],
  ["premiere", /\bpremiere(?:\s+pro)?\b/],
  ["photoshop", /\bphotoshop\b/],
  ["aftereffects", /\bafter\s*effects\b/],
  ["indesign", /\bindesign\b/],
  ["lightroom", /\blightroom\b/],
  ["autocad", /\bautocad\b/],
  ["fusion360", /\bfusion\s*360\b/],
  ["3dsmax", /\b3ds\s*max\b/],
  ["maya", /\bmaya\b/],
  ["blender", /\bblender\b/],
  ["androidstudio", /\bandroid\s*studio\b/],
  ["docker", /\bdocker\b/],
  ["unity", /\bunity\b/],
  ["unrealengine", /\bunreal\s*engine\b/],
  ["windows11", /\bwindows\s*11\b/],
  ["macos", /\bmac\s*os\b|\bmacos\b/],
  ["geforce", /\bgeforce\b/],
  ["ryzen", /\bryzen\b/],
  ["intelcore", /\bintel\s*core\b/],
];

const INTENT_PATTERNS: Array<[string, RegExp]> = [
  [
    "requirements",
    /\brequirements?\b|\bcompatib(?:le|ility)\b|\binstall(?:ation)?\b|\bminimum\b|\brecommended\s+(?:hardware|specs?)\b/,
  ],
  [
    "update",
    /\bupdates?\b|\bupdated\b|\bupdating\b|\breleases?\b|\bversions?\b|\bend[\s-]+of[\s-]+support\b/,
  ],
  ["comparison", /\bcompare\b|\bcomparison\b|\bversus\b|\bvs\.?\b/],
  [
    "buying",
    /\bbuy\b|\bbuying\b|\bpurchase\b|\bpre[\s-]+purchase\b|\bchoose\b|\bchoosing\b/,
  ],
  [
    "troubleshooting",
    /\btroubleshoot(?:ing)?\b|\bfix(?:ing)?\b|\berrors?\b|\bproblems?\b|\bissues?\b/,
  ],
  [
    "policy",
    /\bpolicy\b|\bpolicies\b|\bwarranty\b|\bcancell?ation\b|\bterms\b|\bsupport\s+policy\b/,
  ],
];

function clampInteger(value: number, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampNumber(value: number, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function resolveResearchNoveltyPolicy(
  policy: Partial<ResearchNoveltyPolicy> = {}
): ResearchNoveltyPolicy {
  return {
    windowDays: clampInteger(
      policy.windowDays ?? DEFAULT_RESEARCH_NOVELTY_POLICY.windowDays,
      DEFAULT_RESEARCH_NOVELTY_POLICY.windowDays,
      1,
      3_650
    ),
    similarityThreshold: clampNumber(
      policy.similarityThreshold ??
        DEFAULT_RESEARCH_NOVELTY_POLICY.similarityThreshold,
      DEFAULT_RESEARCH_NOVELTY_POLICY.similarityThreshold,
      0,
      1
    ),
    sourceRotationEnabled:
      policy.sourceRotationEnabled ??
      DEFAULT_RESEARCH_NOVELTY_POLICY.sourceRotationEnabled,
    sourceCooldownDays: clampInteger(
      policy.sourceCooldownDays ??
        DEFAULT_RESEARCH_NOVELTY_POLICY.sourceCooldownDays,
      DEFAULT_RESEARCH_NOVELTY_POLICY.sourceCooldownDays,
      0,
      365
    ),
    sourceCooldownRuns: clampInteger(
      policy.sourceCooldownRuns ??
        DEFAULT_RESEARCH_NOVELTY_POLICY.sourceCooldownRuns,
      DEFAULT_RESEARCH_NOVELTY_POLICY.sourceCooldownRuns,
      0,
      100
    ),
  };
}

export function getResearchNoveltyPolicy(
  calendar: Pick<
    ResearchCalendar,
    | "novelty_window_days"
    | "novelty_similarity_threshold"
    | "source_rotation_enabled"
  >
): ResearchNoveltyPolicy {
  if (
    !Number.isFinite(calendar.novelty_window_days) ||
    calendar.novelty_window_days < 90 ||
    calendar.novelty_window_days > 365 ||
    !Number.isFinite(calendar.novelty_similarity_threshold) ||
    calendar.novelty_similarity_threshold < 20 ||
    calendar.novelty_similarity_threshold > 95 ||
    typeof calendar.source_rotation_enabled !== "boolean"
  ) {
    const error = new Error(
      "Research novelty policy is unavailable. Confirm migration 033 was applied."
    );
    (error as Error & { code?: string }).code = "research_novelty_not_configured";
    throw error;
  }
  return resolveResearchNoveltyPolicy({
    windowDays: calendar.novelty_window_days,
    similarityThreshold: calendar.novelty_similarity_threshold / 100,
    sourceRotationEnabled: calendar.source_rotation_enabled,
  });
}

function normalizedText(value: string): string {
  let result = value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ");

  for (const [pattern, replacement] of PHRASE_ALIASES) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

function lightlyStem(token: string): string {
  if (token.endsWith("ies") && token.length > 5) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("sses") && token.length > 6) {
    return token.slice(0, -2);
  }
  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 4) {
    return token.slice(0, -1);
  }
  return token;
}

export function normalizedTopicTokens(value: string): string[] {
  return normalizedText(value)
    .replace(/\b20\d{2}\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .map(lightlyStem)
    .filter((token) => !STOP_WORDS.has(token));
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function exactTopicFingerprint(title: string): string {
  const source = title
    .toLowerCase()
    .trim()
    .replaceAll("c++", " cplusplus ")
    .replaceAll("c#", " csharp ")
    .replaceAll(".net", " dotnet ");
  const ascii = source.replace(/[^a-z0-9]+/g, " ").trim();
  return ascii || source;
}

export function buildExactTitleFingerprint(title: string): string {
  return exactTopicFingerprint(title);
}

function sourceHostname(value: string): string | null {
  try {
    const candidate = value.includes("://") ? value : `https://${value}`;
    const url = new URL(candidate);
    return url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  } catch {
    return null;
  }
}

export function canonicalRootDomain(value: string): string | null {
  const hostname = sourceHostname(value);
  if (!hostname) return null;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname === "localhost") {
    return hostname;
  }

  const labels = hostname.split(".").filter(Boolean);
  if (labels.length <= 2) return hostname;
  const topLevel = labels.at(-1) ?? "";
  const secondLevel = labels.at(-2) ?? "";
  if (
    topLevel.length === 2 &&
    COUNTRY_CODE_SECOND_LEVEL_LABELS.has(secondLevel) &&
    labels.length >= 3
  ) {
    return labels.slice(-3).join(".");
  }
  return labels.slice(-2).join(".");
}

export const researchRootDomain = canonicalRootDomain;

function isTrackingQueryKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.startsWith("utm_") || TRACKING_QUERY_KEYS.has(normalized);
}

export function canonicalizeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (isTrackingQueryKey(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");
    const canonical = url.toString();
    return canonical.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export const canonicalizeResearchUrl = canonicalizeSourceUrl;

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function extractProducts(value: string): string[] {
  const normalized = normalizedText(value).replace(/[-_/]+/g, " ");
  return PRODUCT_PATTERNS.filter(([, pattern]) => pattern.test(normalized)).map(
    ([product]) => product
  );
}

function extractIntents(value: string): string[] {
  const normalized = normalizedText(value).replace(/[-_/]+/g, " ");
  return INTENT_PATTERNS.filter(([, pattern]) => pattern.test(normalized)).map(
    ([intent]) => intent
  );
}

function extractSourceSubjectTokens(
  canonicalUrls: readonly string[],
  primaryDomain: string | null
): string[] {
  const vendor = primaryDomain?.split(".")[0] ?? null;
  return uniqueSorted(
    canonicalUrls.flatMap((value) => {
      try {
        const url = new URL(value);
        const sourceText = `${url.pathname} ${[...url.searchParams.values()].join(
          " "
        )}`;
        return normalizedTopicTokens(sourceText).filter(
          (token) =>
            token.length >= 4 &&
            token !== vendor &&
            !GENERIC_SOURCE_TOKENS.has(token)
        );
      } catch {
        return [];
      }
    })
  );
}

function canonicalAudienceTokens(audiences: readonly string[]): string[] {
  return uniqueSorted(audiences.flatMap((audience) => normalizedTopicTokens(audience)));
}

function primaryDomainDetails(canonicalUrls: readonly string[]): {
  primaryDomain: string | null;
  primaryDomainShare: number;
  domains: string[];
} {
  const counts = new Map<string, number>();
  for (const url of new Set(canonicalUrls)) {
    const domain = canonicalRootDomain(url);
    if (!domain) continue;
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }
  const entries = [...counts.entries()].sort(
    ([leftDomain, leftCount], [rightDomain, rightCount]) =>
      rightCount - leftCount || leftDomain.localeCompare(rightDomain)
  );
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return {
    primaryDomain: entries[0]?.[0] ?? null,
    primaryDomainShare: total ? (entries[0]?.[1] ?? 0) / total : 0,
    domains: entries.map(([domain]) => domain).sort((left, right) =>
      left.localeCompare(right)
    ),
  };
}

export function buildTopicNoveltyFeatures(topic: NoveltyTopic): TopicNoveltyFeatures {
  const canonicalUrls = uniqueSorted(
    (topic.sourceUrls ?? [])
      .map(canonicalizeSourceUrl)
      .filter((url): url is string => Boolean(url))
  );
  const domainDetails = primaryDomainDetails(canonicalUrls);
  const body = `${topic.angle ?? ""} ${topic.summary ?? ""}`.trim();
  const searchableText = [topic.title, body, ...canonicalUrls].join(" ");
  const products = uniqueSorted([
    ...extractProducts(searchableText),
    ...extractSourceSubjectTokens(canonicalUrls, domainDetails.primaryDomain),
  ]);
  const intents = uniqueSorted(extractIntents(`${topic.title} ${body}`));
  const audiences = canonicalAudienceTokens(topic.audiences ?? []);
  const titleTokens = normalizedTopicTokens(topic.title);
  const bodyTokens = normalizedTopicTokens(body);
  const contentType = topic.contentType?.trim().toLowerCase() || null;
  const exactTitleFingerprint = buildExactTitleFingerprint(topic.title);
  const subjectKey = sha256(
    [
      domainDetails.primaryDomain ?? "",
      products.join(","),
      intents.join(","),
      audiences.join(","),
      contentType ?? "",
      uniqueSorted(titleTokens).join(","),
    ].join("|")
  );

  return {
    exactTitleFingerprint,
    topicFingerprint: exactTitleFingerprint,
    subjectKey,
    titleTokens,
    bodyTokens,
    primaryDomain: domainDetails.primaryDomain,
    primaryDomainShare: domainDetails.primaryDomainShare,
    domains: domainDetails.domains,
    canonicalUrls,
    products,
    intents,
    audiences,
    contentType,
  };
}

function termFrequency(tokens: readonly string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const token of tokens) {
    result.set(token, Math.min(2, (result.get(token) ?? 0) + 1));
  }
  return result;
}

function featureTermSet(features: TopicNoveltyFeatures): Set<string> {
  return new Set([
    ...features.products,
    ...features.intents,
    ...features.audiences,
    ...(features.primaryDomain ? [features.primaryDomain.split(".")[0]] : []),
  ]);
}

function tokenWeight(
  token: string,
  left: TopicNoveltyFeatures,
  right: TopicNoveltyFeatures
): number {
  if (left.products.includes(token) || right.products.includes(token)) return 3;
  const leftVendor = left.primaryDomain?.split(".")[0];
  const rightVendor = right.primaryDomain?.split(".")[0];
  if (token === leftVendor || token === rightVendor) return 2.5;
  const featured = new Set([...featureTermSet(left), ...featureTermSet(right)]);
  if (featured.has(token)) return 2;
  return 1;
}

function weightedCosine(
  leftTokens: readonly string[],
  rightTokens: readonly string[],
  left: TopicNoveltyFeatures,
  right: TopicNoveltyFeatures
): number {
  if (!leftTokens.length || !rightTokens.length) return 0;
  const leftFrequency = termFrequency(leftTokens);
  const rightFrequency = termFrequency(rightTokens);
  const vocabulary = new Set([...leftFrequency.keys(), ...rightFrequency.keys()]);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (const token of vocabulary) {
    const weight = tokenWeight(token, left, right);
    const leftValue = (leftFrequency.get(token) ?? 0) * weight;
    const rightValue = (rightFrequency.get(token) ?? 0) * weight;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }
  if (!leftMagnitude || !rightMagnitude) return 0;
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

function diceSimilarity(left: readonly string[], right: readonly string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (!leftSet.size || !rightSet.size) return 0;
  let intersection = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) intersection += 1;
  }
  return (2 * intersection) / (leftSet.size + rightSet.size);
}

function textSimilarity(
  leftTokens: readonly string[],
  rightTokens: readonly string[],
  left: TopicNoveltyFeatures,
  right: TopicNoveltyFeatures
): number {
  return (
    0.7 * weightedCosine(leftTokens, rightTokens, left, right) +
    0.3 * diceSimilarity(leftTokens, rightTokens)
  );
}

function jaccardSimilarity(
  leftValues: readonly string[],
  rightValues: readonly string[]
): number {
  const left = new Set(leftValues);
  const right = new Set(rightValues);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

function hasIntersection(left: readonly string[], right: readonly string[]): boolean {
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function calculateTopicNoveltyMetrics(
  left: TopicNoveltyFeatures,
  right: TopicNoveltyFeatures
): TopicNoveltyMetrics {
  const title = textSimilarity(left.titleTokens, right.titleTokens, left, right);
  const angle = textSimilarity(left.bodyTokens, right.bodyTokens, left, right);
  const domain =
    left.primaryDomain && left.primaryDomain === right.primaryDomain
      ? 1
      : jaccardSimilarity(left.domains, right.domains);
  const url = hasIntersection(left.canonicalUrls, right.canonicalUrls)
    ? 1
    : jaccardSimilarity(left.canonicalUrls, right.canonicalUrls);
  const intent = jaccardSimilarity(left.intents, right.intents);
  const product = hasIntersection(left.products, right.products)
    ? 1
    : jaccardSimilarity(left.products, right.products);
  const audience = jaccardSimilarity(left.audiences, right.audiences);
  const contentType =
    left.contentType && left.contentType === right.contentType ? 1 : 0;
  const similarity =
    0.24 * title +
    0.25 * angle +
    0.15 * domain +
    0.11 * url +
    0.1 * intent +
    0.08 * product +
    0.04 * audience +
    0.03 * contentType;

  return {
    title: rounded(title),
    angle: rounded(angle),
    domain: rounded(domain),
    url: rounded(url),
    intent: rounded(intent),
    product: rounded(product),
    audience: rounded(audience),
    contentType: rounded(contentType),
    similarity: rounded(similarity),
  };
}

function isWithinHistoryWindow(
  reference: NoveltyTopic,
  now: Date,
  policy: ResearchNoveltyPolicy
): boolean {
  if (reference.kind === "current_batch" || !reference.createdAt) return true;
  const createdAt = Date.parse(reference.createdAt);
  if (!Number.isFinite(createdAt)) return true;
  const windowDays =
    reference.status === "rejected"
      ? Math.min(policy.windowDays, REJECTED_HISTORY_DAYS)
      : policy.windowDays;
  return createdAt >= now.getTime() - windowDays * DAY_MS;
}

function stableReferenceOrder(left: NoveltyTopic, right: NoveltyTopic): number {
  const leftCreated = left.createdAt ? Date.parse(left.createdAt) : 0;
  const rightCreated = right.createdAt ? Date.parse(right.createdAt) : 0;
  if (leftCreated !== rightCreated) return rightCreated - leftCreated;
  return (left.id ?? left.title).localeCompare(right.id ?? right.title);
}

function isSimilarTopic(
  metrics: TopicNoveltyMetrics,
  policy: ResearchNoveltyPolicy
): boolean {
  const strongAnchor =
    metrics.title >= 0.55 ||
    metrics.angle >= 0.55 ||
    metrics.url === 1 ||
    (metrics.domain === 1 && metrics.intent > 0 && metrics.product > 0);
  const exactSourceSubject =
    metrics.url === 1 &&
    metrics.domain === 1 &&
    metrics.intent > 0 &&
    metrics.product > 0;
  return (
    exactSourceSubject ||
    (metrics.similarity >= policy.similarityThreshold && strongAnchor)
  );
}

interface ComparedReference {
  reference: NoveltyTopic;
  metrics: TopicNoveltyMetrics;
  reason: Exclude<TopicNoveltyReason, "novel"> | null;
}

function compareReference(
  candidateFeatures: TopicNoveltyFeatures,
  reference: NoveltyTopic,
  policy: ResearchNoveltyPolicy
): ComparedReference {
  const referenceFeatures = buildTopicNoveltyFeatures(reference);
  const metrics = calculateTopicNoveltyMetrics(candidateFeatures, referenceFeatures);
  const reason =
    candidateFeatures.exactTitleFingerprint ===
    referenceFeatures.exactTitleFingerprint
      ? "exact_title"
      : candidateFeatures.subjectKey === referenceFeatures.subjectKey
        ? "exact_topic"
        : isSimilarTopic(metrics, policy)
          ? "similar_topic"
          : null;
  return { reference, metrics, reason };
}

function comparisonPriority(comparison: ComparedReference): number {
  if (comparison.reason === "exact_title") return 3;
  if (comparison.reason === "exact_topic") return 2;
  if (comparison.reason === "similar_topic") return 1;
  return 0;
}

export function evaluateTopicNovelty(
  candidate: NoveltyTopic,
  references: readonly NoveltyTopic[],
  options: {
    now?: Date;
    policy?: Partial<ResearchNoveltyPolicy>;
  } = {}
): TopicNoveltyEvaluation {
  const policy = resolveResearchNoveltyPolicy(options.policy);
  const now = options.now ?? new Date();
  const candidateFeatures = buildTopicNoveltyFeatures(candidate);
  const comparisons = references
    .filter((reference) => isWithinHistoryWindow(reference, now, policy))
    .map((reference) => compareReference(candidateFeatures, reference, policy))
    .sort((left, right) => {
      const priority = comparisonPriority(right) - comparisonPriority(left);
      if (priority) return priority;
      const similarity = right.metrics.similarity - left.metrics.similarity;
      if (similarity) return similarity;
      return stableReferenceOrder(left.reference, right.reference);
    });
  const duplicate = comparisons.find((comparison) => comparison.reason !== null);
  if (duplicate?.reason) {
    return {
      novel: false,
      reason: duplicate.reason,
      candidate,
      matchedReference: duplicate.reference,
      metrics: duplicate.metrics,
    };
  }
  const closest = comparisons[0] ?? null;
  return {
    novel: true,
    reason: "novel",
    candidate,
    matchedReference: closest?.reference ?? null,
    metrics: closest?.metrics ?? null,
  };
}

function stableCandidateOrder(
  left: { topic: NoveltyTopic; index: number },
  right: { topic: NoveltyTopic; index: number }
): number {
  const confidence =
    (right.topic.confidenceScore ?? 0) - (left.topic.confidenceScore ?? 0);
  if (confidence) return confidence;
  const title = normalizedTopicTokens(left.topic.title)
    .join(" ")
    .localeCompare(normalizedTopicTokens(right.topic.title).join(" "));
  return title || left.index - right.index;
}

export function evaluateTopicNoveltyBatch(
  candidates: readonly NoveltyTopic[],
  references: readonly NoveltyTopic[],
  options: {
    now?: Date;
    policy?: Partial<ResearchNoveltyPolicy>;
  } = {}
): TopicNoveltyBatchResult {
  const accepted: NoveltyTopic[] = [];
  const rejected: TopicNoveltyEvaluation[] = [];
  const evaluations: TopicNoveltyEvaluation[] = [];
  const ordered = candidates
    .map((topic, index) => ({ topic, index }))
    .sort(stableCandidateOrder);

  for (const { topic } of ordered) {
    const currentBatchReferences = accepted.map((acceptedTopic, index) => ({
      ...acceptedTopic,
      id: acceptedTopic.id ?? `current-batch-${index}`,
      kind: "current_batch" as const,
    }));
    const evaluation = evaluateTopicNovelty(
      topic,
      [...references, ...currentBatchReferences],
      options
    );
    evaluations.push(evaluation);
    if (evaluation.novel) accepted.push(topic);
    else rejected.push(evaluation);
  }

  return { accepted, rejected, evaluations };
}

function generatedPacketTopic(
  packet: GeneratedResearchPacket,
  index: number,
  audiences: readonly string[]
): NoveltyTopic {
  return {
    id: `candidate-${index}`,
    kind: "current_batch",
    title: packet.topicTitle,
    angle: packet.topicAngle,
    summary: packet.summary,
    contentType: packet.contentType,
    audiences,
    sourceUrls: packet.findings.map((finding) => finding.sourceUrl),
    confidenceScore: packet.confidenceScore,
  };
}

function percent(value: number): number {
  return Math.round(value * 10_000) / 100;
}

function effectiveSimilarity(
  evaluation: TopicNoveltyEvaluation,
  _policy: ResearchNoveltyPolicy
): number {
  if (evaluation.reason === "exact_title" || evaluation.reason === "exact_topic") {
    return 100;
  }
  const similarity = evaluation.metrics?.similarity ?? 0;
  return percent(similarity);
}

function historyKind(
  topic: NoveltyTopic | null
): ResearchHistoryKind | null {
  return topic?.kind === "research_packet" || topic?.kind === "blog_post"
    ? topic.kind
    : null;
}

function selectionMessage(input: {
  candidates: number;
  accepted: number;
  rejected: number;
}): string {
  if (!input.candidates) {
    return "No research candidates were returned for novelty evaluation.";
  }
  if (!input.accepted) {
    return "Every research candidate matched a topic already explored within the novelty window.";
  }
  if (input.rejected) {
    return `${input.accepted} candidate(s) passed novelty review; ${input.rejected} duplicate topic(s) were removed.`;
  }
  return `${input.accepted} candidate(s) passed deterministic novelty review.`;
}

export function selectNovelResearchPackets(input: {
  candidates: readonly GeneratedResearchPacket[];
  references: readonly NoveltyReference[];
  audiences?: readonly string[];
  policy: Partial<ResearchNoveltyPolicy>;
  now?: Date;
}): NoveltySelectionResult {
  const now = input.now ?? new Date();
  const policy = resolveResearchNoveltyPolicy(input.policy);
  const entries = input.candidates.map((packet, index) => ({
    packet,
    topic: generatedPacketTopic(packet, index, input.audiences ?? []),
  }));
  const byId = new Map(entries.map((entry) => [entry.topic.id, entry]));
  const batch = evaluateTopicNoveltyBatch(
    entries.map((entry) => entry.topic),
    input.references,
    { now, policy }
  );
  const evaluationsByCandidate = new Map(
    batch.evaluations.map((evaluation) => [evaluation.candidate.id, evaluation])
  );
  const packets = batch.accepted.flatMap((topic): NovelResearchPacket[] => {
    const entry = topic.id ? byId.get(topic.id) : null;
    const batchEvaluation = topic.id
      ? evaluationsByCandidate.get(topic.id)
      : null;
    if (!entry || !batchEvaluation) return [];
    // Current-batch comparisons decide which candidate survives, but they are
    // not durable history. Re-evaluate accepted candidates against persisted
    // references so every stored nearest-topic field describes the same match
    // that produced the stored novelty score.
    const auditEvaluation = evaluateTopicNovelty(topic, input.references, {
      now,
      policy,
    });
    const features = buildTopicNoveltyFeatures(topic);
    const nearestKind = historyKind(auditEvaluation.matchedReference);
    const nearestSimilarity = auditEvaluation.metrics
      ? effectiveSimilarity(auditEvaluation, policy)
      : null;
    return [
      {
        packet: entry.packet,
        topicFingerprint: features.topicFingerprint,
        subjectKey: features.subjectKey,
        noveltyScore:
          nearestSimilarity === null ? 100 : rounded(100 - nearestSimilarity),
        nearestTopicSimilarity: nearestKind ? nearestSimilarity : null,
        nearestTopicKind: nearestKind,
        nearestTopicId: nearestKind
          ? (auditEvaluation.matchedReference?.id ?? null)
          : null,
        nearestTopicTitle: nearestKind
          ? (auditEvaluation.matchedReference?.title.slice(0, 1_000) ?? null)
          : null,
        noveltyWindowDays: policy.windowDays,
        noveltyCheckedAt: now.toISOString(),
        sourceDomains: features.domains,
      },
    ];
  });
  const rejections = batch.rejected.flatMap(
    (evaluation): NoveltyRejection[] => {
      const matched = evaluation.matchedReference;
      if (!matched?.id || !matched.kind || !evaluation.metrics) return [];
      return [
        {
          reason: "duplicate_topic",
          candidateTitle: evaluation.candidate.title,
          matchedId: matched.id,
          matchedKind: matched.kind,
          matchedTitle: matched.title,
          similarityScore: effectiveSimilarity(evaluation, policy),
          metrics: evaluation.metrics,
        },
      ];
    }
  );
  const closestDuplicate = rejections
    .filter(
      (rejection) =>
        rejection.matchedKind === "research_packet" ||
        rejection.matchedKind === "blog_post"
    )
    .sort(
      (left, right) =>
        right.similarityScore - left.similarityScore ||
        left.matchedId.localeCompare(right.matchedId)
    )[0];
  const closestReference = closestDuplicate
    ? input.references.find(
        (reference) => reference.id === closestDuplicate.matchedId
      )
    : null;
  const primaryReason: ResearchSelectionReasonCode | null = !input.candidates.length
    ? "no_qualifying_candidate"
    : packets.length
      ? null
      : "duplicate_topic";
  const summary: ResearchSelectionSummary = {
    primaryReason,
    message: selectionMessage({
      candidates: input.candidates.length,
      accepted: packets.length,
      rejected: rejections.length,
    }),
    candidatesEvaluated: input.candidates.length,
    candidatesAccepted: packets.length,
    rejectionCounts: rejections.length
      ? { duplicate_topic: rejections.length }
      : {},
    historyWindowDays: policy.windowDays,
    similarityThreshold: percent(policy.similarityThreshold),
    closestDuplicate:
      closestDuplicate &&
      closestReference &&
      (closestDuplicate.matchedKind === "research_packet" ||
        closestDuplicate.matchedKind === "blog_post")
        ? {
            candidateTitle: closestDuplicate.candidateTitle,
            matchedTitle: closestDuplicate.matchedTitle,
            similarityScore: closestDuplicate.similarityScore,
            matchedKind: closestDuplicate.matchedKind,
            matchedAt: closestReference.createdAt,
          }
        : null,
  };

  return { packets, rejections, summary };
}

function validUseTimestamp(use: SourceRotationUse): number | null {
  const timestamp = Date.parse(use.usedAt);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function cooledSourceDomains(
  uses: readonly SourceRotationUse[],
  options: {
    now?: Date;
    policy?: Partial<ResearchNoveltyPolicy>;
  } = {}
): string[] {
  const policy = resolveResearchNoveltyPolicy(options.policy);
  if (
    !policy.sourceRotationEnabled ||
    policy.sourceCooldownDays === 0 ||
    policy.sourceCooldownRuns === 0
  ) {
    return [];
  }
  const now = options.now ?? new Date();
  const cutoff = now.getTime() - policy.sourceCooldownDays * DAY_MS;
  const usesByRun = new Map<
    string,
    { timestamp: number; sourceUrls: Set<string> }
  >();
  for (const use of uses) {
    const timestamp = validUseTimestamp(use);
    if (
      timestamp === null ||
      timestamp < cutoff ||
      timestamp > now.getTime()
    ) {
      continue;
    }
    const current = usesByRun.get(use.runId) ?? {
      timestamp,
      sourceUrls: new Set<string>(),
    };
    current.timestamp = Math.max(current.timestamp, timestamp);
    for (const url of use.sourceUrls) current.sourceUrls.add(url);
    usesByRun.set(use.runId, current);
  }
  const recentUses = [...usesByRun.entries()].map(
    ([runId, entry]) => ({
      use: {
        runId,
        usedAt: new Date(entry.timestamp).toISOString(),
        sourceUrls: [...entry.sourceUrls],
      },
      timestamp: entry.timestamp,
    })
  );

  const runTimestamps = new Map<string, number>();
  for (const { use, timestamp } of recentUses) {
    runTimestamps.set(use.runId, Math.max(timestamp, runTimestamps.get(use.runId) ?? 0));
  }
  const selectedRuns = new Set(
    [...runTimestamps.entries()]
      .sort(
        ([leftId, leftTimestamp], [rightId, rightTimestamp]) =>
          rightTimestamp - leftTimestamp || leftId.localeCompare(rightId)
      )
      .slice(0, policy.sourceCooldownRuns)
      .map(([runId]) => runId)
  );

  const cooled = new Set<string>();
  for (const { use } of recentUses) {
    if (!selectedRuns.has(use.runId)) continue;
    const canonicalUrls = uniqueSorted(
      use.sourceUrls
        .map(canonicalizeSourceUrl)
        .filter((url): url is string => Boolean(url))
    );
    const primary = primaryDomainDetails(canonicalUrls);
    if (
      primary.primaryDomain &&
      primary.primaryDomainShare >= PRIMARY_SOURCE_MIN_SHARE
    ) {
      cooled.add(primary.primaryDomain);
    }
  }
  return uniqueSorted(cooled);
}

export function sourceRotationDomains(input: {
  references: readonly NoveltyReference[];
  calendarDayId: string;
  policy: Partial<ResearchNoveltyPolicy>;
  now?: Date;
}): string[] {
  const uses = input.references
    .filter(
      (reference) =>
        reference.kind === "research_packet" &&
        reference.calendarDayId === input.calendarDayId &&
        reference.sourceUrls?.length
    )
    .map((reference) => ({
      runId: reference.scheduleRunId ?? reference.id,
      usedAt: reference.createdAt,
      sourceUrls: reference.sourceUrls ?? [],
    }));
  return cooledSourceDomains(uses, {
    now: input.now,
    policy: input.policy,
  });
}

export function applySourceCooldown(
  allowedDomains: readonly string[],
  uses: readonly SourceRotationUse[],
  options: {
    now?: Date;
    policy?: Partial<ResearchNoveltyPolicy>;
  } = {}
): SourceCooldownResult {
  const cooledDomains = cooledSourceDomains(uses, options);
  const cooledSet = new Set(cooledDomains);
  const allowed = uniqueSorted(
    allowedDomains
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean)
      .filter((domain) => {
        const root = canonicalRootDomain(domain);
        return Boolean(root && !cooledSet.has(root));
      })
  );
  return { allowedDomains: allowed, cooledDomains };
}
