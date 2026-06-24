import type { Laptop, FilterState } from "@/lib/types";
import { getRecommendations } from "@/lib/recommendationEngine";
import { BRANDS } from "@/lib/constants";
import { ALL_WORKLOAD_TAGS } from "@/lib/domains";

// Synonyms that map free-text editorial language onto the catalog's workload tags.
const WORKLOAD_SYNONYMS: { tag: string; keywords: string[] }[] = [
  { tag: "game", keywords: ["gaming", "game dev", "game development", "games", "game"] },
  { tag: "3d", keywords: ["3d", "modeling", "modelling", "cad", "solidworks", "blender"] },
  { tag: "rendering", keywords: ["render", "rendering"] },
  { tag: "animation", keywords: ["animation", "animate", "motion graphics"] },
  { tag: "video", keywords: ["video editing", "video", "premiere", "davinci", "editing"] },
  { tag: "uiux", keywords: ["ui/ux", "ui ux", "uiux", "figma", "ux", "ui design"] },
  { tag: "coding", keywords: ["coding", "programming", "developer", "software", "web dev", "python", "java"] },
  { tag: "ai", keywords: ["ai workflows", "machine learning", "deep learning", " ml ", "ai/ml", "ai "] },
  { tag: "fashion", keywords: ["fashion"] },
  { tag: "interior", keywords: ["interior"] },
  { tag: "product", keywords: ["product design", "industrial design"] },
  { tag: "2d", keywords: ["2d", "illustration", "graphic design", "photoshop"] },
];

const TIERS: FilterState["tier"][] = ["budget", "value", "balanced", "advanced", "premium"];

// Parse a maximum budget (in ₹) out of editorial text. Only triggers on an
// explicit budget cue, a currency symbol, or a k/lakh suffix — so spec numbers
// like "16gb" or "rtx 4060" are never mistaken for a price.
function parseBudget(text: string): number | undefined {
  const lakh = text.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|lkh)\b/);
  if (lakh) return Math.round(parseFloat(lakh[1]) * 100_000);

  const k = text.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (k) return Math.round(parseFloat(k[1]) * 1_000);

  const cue = text.match(
    /(?:under|below|upto|up to|within|less than|budget of|max(?:imum)?|<)\s*₹?\s*([\d,]{4,9})/
  );
  if (cue) return parseInt(cue[1].replace(/,/g, ""), 10);

  const currency = text.match(/₹\s*([\d,]{4,9})/);
  if (currency) return parseInt(currency[1].replace(/,/g, ""), 10);

  return undefined;
}

function parseProcessor(text: string): string | undefined {
  if (/\bapple\b|\bm[1-4]\b|apple silicon|macbook/.test(text)) return "apple";
  if (/\bryzen\b|\bamd\b/.test(text)) return "amd";
  if (/\bintel\b|\bcore i[3579]\b/.test(text)) return "intel";
  return undefined;
}

// Best-effort, deterministic translation of an editorial intent string into the
// same FilterState the public results page uses. Never invents data.
export function parseIntent(intent: string | null | undefined): FilterState {
  const text = ` ${(intent ?? "").toLowerCase()} `;

  const workloadTags = WORKLOAD_SYNONYMS.filter((w) =>
    w.keywords.some((kw) => text.includes(kw))
  ).map((w) => w.tag);
  // Keep only tags that exist in the catalog's known set.
  const knownTags = new Set(ALL_WORKLOAD_TAGS.map((t) => t.value));
  const tags = [...new Set(workloadTags)].filter((t) => knownTags.has(t as never));

  const tier = TIERS.find((t) => t && text.includes(` ${t} `)) ?? undefined;
  const brand = BRANDS.find((b) => text.includes(b.toLowerCase()));

  return {
    searchQuery: "",
    workloadTags: tags,
    maxBudget: parseBudget(text),
    tier,
    brand,
    processorType: parseProcessor(text),
  };
}

function clampLimit(limit: number | undefined): number {
  if (!limit || Number.isNaN(limit)) return 3;
  return Math.max(1, Math.min(5, Math.round(limit)));
}

/**
 * Select real, published laptops for a blog product block from its editorial
 * intent. Ranks with the same engine the public results page uses, and
 * progressively relaxes the hard filters so a relevant grid still appears as the
 * catalog changes. Returns [] only when there are no laptops at all.
 */
export function selectProductsForIntent(
  laptops: Laptop[] | undefined,
  intent: string | null | undefined,
  limit?: number
): Laptop[] {
  const n = clampLimit(limit);
  if (!laptops?.length) return [];

  const base = parseIntent(intent);
  const attempts: FilterState[] = [
    base,
    { ...base, brand: undefined, processorType: undefined },
    { ...base, brand: undefined, processorType: undefined, tier: undefined },
    {
      ...base,
      brand: undefined,
      processorType: undefined,
      tier: undefined,
      maxBudget: undefined,
    },
  ];

  for (const filters of attempts) {
    const ranked = getRecommendations(laptops, filters, "recommended");
    if (ranked.length > 0) return ranked.slice(0, n);
  }

  // Ultimate fallback: highest-priority published laptops.
  return [...laptops]
    .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0))
    .slice(0, n);
}
