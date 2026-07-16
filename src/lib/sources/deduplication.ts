import type { NormalizedLaptop } from "./types";

const NOISE_TOKENS = new Set([
  "laptop",
  "notebook",
  "gaming",
  "computer",
  "with",
  "and",
  "for",
  "inch",
  "inches",
  "series",
  "edition",
  "windows",
  "home",
  "smartchoice",
  "latest",
]);

export interface ComparableProduct {
  id?: string;
  sourceKey: string;
  sourceProductId?: string;
  title: string;
  brand?: string;
  model?: string;
}

export interface DuplicateMatch {
  id?: string;
  score: number;
  reason: "same_source_id" | "same_brand_model" | "similar_identity";
}

export function canonicalProductText(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function productIdentityTokens(product: ComparableProduct): Set<string> {
  const identity = [product.brand, product.model, product.title]
    .map(canonicalProductText)
    .join(" ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !NOISE_TOKENS.has(token));
  return new Set(identity);
}

export function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Stable per-source key used for idempotent ingestion. This is deliberately
 * readable (rather than an opaque hash) so admins can troubleshoot collisions.
 */
export function buildCandidateDedupeKey(product: ComparableProduct): string {
  const sourceId = canonicalProductText(product.sourceProductId);
  if (sourceId) return `id:${sourceId}`.slice(0, 400);

  const brand = canonicalProductText(product.brand);
  const model = canonicalProductText(product.model);
  if (brand && model) return `model:${brand}:${model}`.slice(0, 400);

  const tokens = [...productIdentityTokens(product)].sort();
  const titleFallback = canonicalProductText(product.title).slice(0, 320);
  return `title:${tokens.join("-") || titleFallback}`.slice(0, 400);
}

export function compareProducts(
  candidate: ComparableProduct,
  existing: ComparableProduct
): DuplicateMatch | null {
  const candidateId = canonicalProductText(candidate.sourceProductId);
  const existingId = canonicalProductText(existing.sourceProductId);
  if (
    candidate.sourceKey === existing.sourceKey &&
    candidateId &&
    candidateId === existingId
  ) {
    return { id: existing.id, score: 1, reason: "same_source_id" };
  }

  const candidateBrand = canonicalProductText(candidate.brand);
  const existingBrand = canonicalProductText(existing.brand);
  const candidateModel = canonicalProductText(candidate.model);
  const existingModel = canonicalProductText(existing.model);
  if (
    candidateBrand &&
    candidateBrand === existingBrand &&
    candidateModel &&
    candidateModel === existingModel
  ) {
    return { id: existing.id, score: 0.98, reason: "same_brand_model" };
  }

  const titleScore = jaccardSimilarity(
    productIdentityTokens(candidate),
    productIdentityTokens(existing)
  );
  const brandBoost = candidateBrand && candidateBrand === existingBrand ? 0.1 : 0;
  const score = Math.min(0.95, titleScore + brandBoost);
  if (score < 0.72) return null;
  return {
    id: existing.id,
    score: Math.round(score * 100) / 100,
    reason: "similar_identity",
  };
}

export function findDuplicateMatches(
  candidate: ComparableProduct,
  existing: ComparableProduct[]
): DuplicateMatch[] {
  return existing
    .map((product) => compareProducts(candidate, product))
    .filter((match): match is DuplicateMatch => match !== null)
    .sort((left, right) => right.score - left.score);
}

export function toComparableProduct(
  normalized: NormalizedLaptop,
  id?: string
): ComparableProduct {
  return {
    id,
    sourceKey: normalized.sourceKey,
    sourceProductId: normalized.sourceProductId,
    title: normalized.title,
    brand: normalized.brand,
    model: normalized.model,
  };
}
