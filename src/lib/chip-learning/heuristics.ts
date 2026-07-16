import type {
  ChipDomain,
  ChipPreferenceSignals,
} from "./types";

const MAX_ANALYZED_CHARACTERS = 12_000;
const MIN_BUDGET_INR = 5_000;
const MAX_BUDGET_INR = 10_000_000;

type TaggedPattern = readonly [tag: string, pattern: RegExp];

const ROLE_PATTERNS: readonly TaggedPattern[] = [
  ["student", /\b(?:student|college|university|school)\b/i],
  ["fresher", /\b(?:fresher|aspirant|beginner|just starting|just exploring)\b/i],
  ["professional", /\b(?:professional|working|job|freelancer|business owner)\b/i],
  ["parent", /\b(?:my son|my daughter|my child|parent)\b/i],
];

const COURSE_PATTERNS: readonly TaggedPattern[] = [
  ["fashion-design", /\b(?:fashion design|fashion student|clothing design)\b/i],
  ["interior-design", /\b(?:interior design|interior student)\b/i],
  ["graphic-design", /\b(?:graphic design|visual communication)\b/i],
  ["product-design", /\b(?:product design|industrial design)\b/i],
  ["architecture", /\b(?:architecture|architectural)\b/i],
  ["animation-vfx", /\b(?:animation|vfx|visual effects)\b/i],
  ["computer-science", /\b(?:computer science|\bcse\b|software engineering)\b/i],
  ["data-science", /\b(?:data science|data analytics)\b/i],
  ["ai-ml", /\b(?:artificial intelligence|machine learning|\bai\s*\/\s*ml\b)\b/i],
  ["cybersecurity", /\b(?:cybersecurity|cyber security|ethical hacking)\b/i],
  ["game-development", /\b(?:game development|game design)\b/i],
  ["mba", /\b(?:mba|business school|management student)\b/i],
  ["finance", /\b(?:finance|fintech|financial modelling|financial modeling)\b/i],
  ["business-analytics", /\b(?:business analytics|business intelligence)\b/i],
  ["marketing", /\b(?:marketing|digital marketing)\b/i],
  ["operations", /\b(?:operations|supply chain)\b/i],
  ["product-management", /\bproduct management\b/i],
];

const SOFTWARE_PATTERNS: readonly TaggedPattern[] = [
  ["photoshop", /\b(?:adobe\s+)?photoshop\b/i],
  ["illustrator", /\b(?:adobe\s+)?illustrator\b/i],
  ["premiere-pro", /\b(?:adobe\s+)?premiere(?:\s+pro)?\b/i],
  ["after-effects", /\b(?:adobe\s+)?after effects\b/i],
  ["clo-3d", /\bclo\s*3d\b/i],
  ["autocad", /\bauto\s*cad\b/i],
  ["revit", /\brevit\b/i],
  ["sketchup", /\bsketch\s*up\b/i],
  ["lumion", /\blumion\b/i],
  ["3ds-max", /\b3ds\s*max\b/i],
  ["blender", /\bblender\b/i],
  ["solidworks", /\bsolid\s*works\b/i],
  ["fusion-360", /\bfusion\s*360\b/i],
  ["rhino", /\brhino(?:ceros)?\b/i],
  ["figma", /\bfigma\b/i],
  ["android-studio", /\bandroid studio\b/i],
  ["visual-studio", /\bvisual studio(?!\s+code)\b/i],
  ["vs-code", /\b(?:vs\s*code|visual studio code)\b/i],
  ["docker", /\bdocker\b/i],
  ["unity", /\bunity\b/i],
  ["unreal-engine", /\bunreal(?:\s+engine)?\b/i],
  ["python", /\bpython\b/i],
  ["matlab", /\bmatlab\b/i],
  ["excel", /\b(?:microsoft\s+)?excel\b/i],
  ["power-bi", /\bpower\s*bi\b/i],
  ["tableau", /\btableau\b/i],
  ["spss", /\bspss\b/i],
];

const PRIORITY_PATTERNS: readonly TaggedPattern[] = [
  ["portability", /\b(?:portable|portability|lightweight|light weight|easy to carry|travel)\b/i],
  ["battery-life", /\b(?:battery|all[- ]day|long lasting|long-lasting)\b/i],
  ["gaming", /\b(?:gaming|games|high fps|esports)\b/i],
  ["3d-performance", /\b(?:3d|rendering|simulation|cad)\b/i],
  ["display-quality", /\b(?:display|screen|colour accurate|color accurate|oled)\b/i],
  ["performance", /\b(?:performance|powerful|fast|heavy workload)\b/i],
  ["future-proof", /\b(?:future[- ]proof|four years|4 years|long term)\b/i],
  ["upgradeability", /\b(?:upgrade|upgradeable|expandable ram|extra ssd)\b/i],
  ["thermals", /\b(?:thermal|cooling|overheat|heating|quiet fans?)\b/i],
  ["value", /\b(?:value for money|affordable|cheaper|budget friendly|budget-friendly)\b/i],
];

const INTENT_PATTERNS: readonly TaggedPattern[] = [
  ["recommendation", /\b(?:recommend|suggest|show me|which laptop|what laptop|best laptop)\b/i],
  ["comparison", /\b(?:compare|comparison|versus|\bvs\b|difference between)\b/i],
  ["purchase-planning", /\b(?:buy|buying|purchase|shortlist)\b/i],
  ["uncertain", /\b(?:not sure|don't know|do not know|no idea|help me decide|you tell me)\b/i],
];

const BRAND_PATTERNS: readonly TaggedPattern[] = [
  ["asus", /\basus\b/i],
  ["acer", /\bacer\b/i],
  ["dell", /\bdell\b/i],
  ["hp", /\bhp\b/i],
  ["lenovo", /\blenovo\b/i],
  ["msi", /\bmsi\b/i],
  ["apple", /\b(?:apple|macbook)\b/i],
];

const NEGATIVE_BRAND_BEFORE =
  /\b(?:avoid|no|never|hate|dislike|except|don't want|do not want)\s*$/i;
const NEGATIVE_BRAND_AFTER =
  /^\s*(?:is\s+|has\s+)?(?:not|bad|poor|unreliable|bad service)\b/i;
const POSITIVE_BRAND_BEFORE =
  /\b(?:prefer|like|want|favour|favor|fan of|looking for|must be)(?:\s+(?:a|an|the))?\s*$/i;
const POSITIVE_BRAND_AFTER =
  /^\s*(?:only|preferred|is\s+(?:fine|good|preferred))\b/i;

const AMOUNT_SOURCE =
  String.raw`(?:(?:₹|rs\.?|inr)\s*)?(?:(?:\d{1,3}(?:,\d{2,3})+)|(?:\d+(?:\.\d+)?)|one|two)\s*(?:k|thousand|l|lac|lakh|lakhs)?`;

function normalizedInput(input: string | readonly string[]): string {
  const value = Array.isArray(input) ? input.join(" \n ") : input;
  return String(value)
    .normalize("NFKC")
    .replace(/[–—]/g, "-")
    .replace(/[’]/g, "'")
    .slice(-MAX_ANALYZED_CHARACTERS)
    .toLowerCase();
}

function tagsFor(text: string, patterns: readonly TaggedPattern[]): string[] {
  return patterns
    .filter(([, pattern]) => pattern.test(text))
    .map(([tag]) => tag)
    .sort();
}

function parseAmountToken(token: string, allowPlain = false): number | null {
  const normalized = token.trim().toLowerCase();
  const hasCurrency = /₹|\brs\.?|\binr\b/.test(normalized);
  const unit = /(?:\d|one|two)\s*(k|thousand|l|lac|lakh|lakhs)\b/.exec(
    normalized
  )?.[1];
  const wordValue = /\bone\b/.test(normalized)
    ? 1
    : /\btwo\b/.test(normalized)
      ? 2
      : null;
  const numeric = wordValue ?? Number(normalized.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  let multiplier = 1;
  if (unit === "k" || unit === "thousand") multiplier = 1_000;
  if (unit === "l" || unit === "lac" || unit === "lakh" || unit === "lakhs") {
    multiplier = 100_000;
  }
  if (!unit && !hasCurrency && !allowPlain) return null;

  const amount = Math.round(numeric * multiplier);
  return amount >= MIN_BUDGET_INR && amount <= MAX_BUDGET_INR
    ? amount
    : null;
}

function extractBudget(text: string): {
  budgetMin: number | null;
  budgetMax: number | null;
} {
  const budgetContext =
    /\b(?:budget|spend|spending|range|price|cost|afford|under|below|over|above|between|up to|upto)\b/.test(
      text
    );

  const rangePattern = new RegExp(
    `(?:between\\s+)?(${AMOUNT_SOURCE})\\s*(?:-|to|and)\\s*(${AMOUNT_SOURCE})`,
    "i"
  );
  const range = rangePattern.exec(text);
  if (range) {
    const first = parseAmountToken(range[1], budgetContext);
    const second = parseAmountToken(range[2], budgetContext);
    if (first !== null && second !== null) {
      return {
        budgetMin: Math.min(first, second),
        budgetMax: Math.max(first, second),
      };
    }
  }

  const upperPattern = new RegExp(
    `(?:under|below|less\\s+than|not\\s+more\\s+than|max(?:imum)?|up\\s+to|upto)\\s*(${AMOUNT_SOURCE})`,
    "i"
  );
  const upper = upperPattern.exec(text);
  if (upper) {
    const amount = parseAmountToken(upper[1], true);
    if (amount !== null) return { budgetMin: null, budgetMax: amount };
  }

  const lowerPattern = new RegExp(
    `(?:over|above|more\\s+than|min(?:imum)?)\\s*(${AMOUNT_SOURCE})`,
    "i"
  );
  const lower = lowerPattern.exec(text);
  if (lower) {
    const amount = parseAmountToken(lower[1], true);
    if (amount !== null) return { budgetMin: amount, budgetMax: null };
  }

  const contextualPattern = new RegExp(
    `(?:budget|spend|spending|afford|price|cost)[^\\n]{0,24}?(${AMOUNT_SOURCE})`,
    "i"
  );
  const contextual = contextualPattern.exec(text);
  if (contextual) {
    const amount = parseAmountToken(contextual[1], true);
    if (amount !== null) return { budgetMin: null, budgetMax: amount };
  }

  const markedPattern = new RegExp(
    `((?:(?:₹|rs\\.?|inr)\\s*)?(?:(?:\\d{1,3}(?:,\\d{2,3})+)|(?:\\d+(?:\\.\\d+)?))\\s*(?:k|thousand|l|lac|lakh|lakhs))|((?:₹|rs\\.?|inr)\\s*(?:\\d{1,3}(?:,\\d{2,3})+|\\d+))`,
    "i"
  );
  const marked = markedPattern.exec(text);
  const amount = marked
    ? parseAmountToken(marked[1] ?? marked[2], false)
    : null;
  return { budgetMin: null, budgetMax: amount };
}

function extractBrandPreferences(text: string): string[] {
  const preferences: string[] = [];

  for (const [brand, pattern] of BRAND_PATTERNS) {
    const matches = text.matchAll(
      new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`)
    );
    let latestPreference: string | null = null;
    for (const match of matches) {
      if (match.index === undefined) continue;
      const before = text.slice(Math.max(0, match.index - 36), match.index);
      const after = text.slice(
        match.index + match[0].length,
        match.index + match[0].length + 30
      );
      if (
        NEGATIVE_BRAND_BEFORE.test(before) ||
        NEGATIVE_BRAND_AFTER.test(after)
      ) {
        latestPreference = `avoid:${brand}`;
      } else if (
        POSITIVE_BRAND_BEFORE.test(before) ||
        POSITIVE_BRAND_AFTER.test(after)
      ) {
        latestPreference = `prefer:${brand}`;
      }
    }
    if (latestPreference) preferences.push(latestPreference);
  }

  return [...new Set(preferences)].sort();
}

export function countChipPreferenceSignals(
  signals: ChipPreferenceSignals
): number {
  return (
    (signals.budgetMin !== null || signals.budgetMax !== null ? 1 : 0) +
    signals.roleTags.length +
    signals.courseTags.length +
    signals.softwareTags.length +
    signals.brandPreferences.length +
    signals.priorityTags.length +
    signals.intentTags.length
  );
}

export function hasChipPreferenceSignals(
  signals: ChipPreferenceSignals
): boolean {
  return countChipPreferenceSignals(signals) > 0;
}

/**
 * Deterministically extracts only a closed vocabulary of recommendation
 * signals. It returns no source text and intentionally has no PII fields.
 */
export function extractChipPreferences(
  input: string | readonly string[],
  _domain: ChipDomain
): ChipPreferenceSignals {
  const text = normalizedInput(input);
  const budget = extractBudget(text);
  const result: ChipPreferenceSignals = {
    ...budget,
    roleTags: tagsFor(text, ROLE_PATTERNS),
    courseTags: tagsFor(text, COURSE_PATTERNS),
    softwareTags: tagsFor(text, SOFTWARE_PATTERNS),
    brandPreferences: extractBrandPreferences(text),
    priorityTags: tagsFor(text, PRIORITY_PATTERNS),
    intentTags: tagsFor(text, INTENT_PATTERNS),
    confidence: 0,
  };

  const signalCount = countChipPreferenceSignals(result);
  result.confidence =
    signalCount === 0 ? 0 : Math.min(0.95, Math.round((0.15 + signalCount * 0.08) * 100) / 100);
  return result;
}

function mergeBrandPreferences(
  previous: readonly string[],
  current: readonly string[]
): string[] {
  const byBrand = new Map<string, string>();
  for (const value of [...previous, ...current]) {
    const [, brand] = value.split(":", 2);
    if (brand) byBrand.set(brand, value);
  }
  return [...byBrand.values()].sort();
}

export function mergeChipPreferenceSignals(
  previous: ChipPreferenceSignals,
  current: ChipPreferenceSignals
): ChipPreferenceSignals {
  const hasCurrentBudget =
    current.budgetMin !== null || current.budgetMax !== null;
  const merged: ChipPreferenceSignals = {
    budgetMin: hasCurrentBudget ? current.budgetMin : previous.budgetMin,
    budgetMax: hasCurrentBudget ? current.budgetMax : previous.budgetMax,
    roleTags: [...new Set([...previous.roleTags, ...current.roleTags])].sort(),
    courseTags: [...new Set([...previous.courseTags, ...current.courseTags])].sort(),
    softwareTags: [
      ...new Set([...previous.softwareTags, ...current.softwareTags]),
    ].sort(),
    brandPreferences: mergeBrandPreferences(
      previous.brandPreferences,
      current.brandPreferences
    ),
    priorityTags: [
      ...new Set([...previous.priorityTags, ...current.priorityTags]),
    ].sort(),
    intentTags: [...new Set([...previous.intentTags, ...current.intentTags])].sort(),
    confidence: 0,
  };
  const count = countChipPreferenceSignals(merged);
  merged.confidence =
    count === 0 ? 0 : Math.min(0.95, Math.round((0.15 + count * 0.08) * 100) / 100);
  return merged;
}

export function extractChipConversationPreferences(
  messages: readonly string[],
  domain: ChipDomain
): ChipPreferenceSignals {
  const empty = extractChipPreferences("", domain);
  return messages.reduce(
    (profile, message) =>
      mergeChipPreferenceSignals(
        profile,
        extractChipPreferences(message, domain)
      ),
    empty
  );
}
