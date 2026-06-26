// Duplicate detection helpers for the admin "Fetch & Extract" flow.
//
// Stored Amazon URLs are mostly amzn.to short links, so we can't dedup by ASIN
// string-matching the URL. Instead we dedup on a resolved `asin` column (exact)
// plus a fuzzy comparison of product names (catches the same laptop saved under
// a different/variant ASIN, and legacy rows whose asin isn't backfilled yet).

// Generic words that carry no identifying signal — dropped before comparing so
// "HP Omen Gaming Laptop" and "HP Smartchoice Omen 16" still line up on "hp"/"omen".
const NOISE_TOKENS = new Set([
  "laptop",
  "gaming",
  "notebook",
  "with",
  "and",
  "the",
  "for",
  "chip",
  "series",
  "edition",
  "inch",
  "smartchoice",
]);

/** Lowercase, strip punctuation, drop noise words → set of identifying tokens. */
export function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !NOISE_TOKENS.has(t))
  );
}

/** Jaccard similarity (0–1) between two product names' identifying tokens. */
export function nameSimilarity(a: string, b: string): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Names scoring at/above this are surfaced as "possible" duplicates for the
// admin to verify. Kept moderately loose on purpose — the admin confirms by eye.
export const NAME_MATCH_THRESHOLD = 0.45;

export type DuplicateMatch = "exact-asin" | "similar-name";

export interface DuplicateCandidate {
  id: string;
  name: string;
  slug: string;
  asin: string | null;
  match: DuplicateMatch;
  /** Name-similarity score 0–1 (1 for exact-asin matches). */
  score: number;
}

/**
 * Given the candidate ASIN + name and the existing laptops in the same domain,
 * return everything that looks like a duplicate, exact-ASIN matches first.
 */
export function findDuplicateCandidates(
  asin: string,
  productName: string,
  existing: { id: string; name: string; slug: string; asin: string | null }[]
): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];

  for (const row of existing) {
    if (row.asin && row.asin.toUpperCase() === asin.toUpperCase()) {
      candidates.push({ ...row, match: "exact-asin", score: 1 });
      continue;
    }
    const score = nameSimilarity(productName, row.name);
    if (score >= NAME_MATCH_THRESHOLD) {
      candidates.push({ ...row, match: "similar-name", score });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}
