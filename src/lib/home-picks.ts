import { getGpuStrengthScore } from "@/lib/constants";
import type { DomainId } from "@/lib/domains";

// Automated selection for the home hub's picks carousel. Replaces the old
// hand-starred "Editor's Picks" list: every card is now derived from the live
// catalog, so the landing page keeps pace with price refreshes without an admin
// remembering to re-star anything.
//
// `feature_on_home` survives as a *pin* — an explicit admin override that forces
// a laptop into the carousel — rather than as the source of truth.
//
// Pure functions only (no server-only imports) so the rules stay unit-testable
// and the types can be shared with the client component.

export type HomePickSlideId = "value" | "power";

/** The laptop columns the carousel needs. Deliberately narrower than `Laptop`. */
export interface HomePickCandidate {
  id: string;
  slug: string;
  domain: string | null;
  name: string;
  brand?: string | null;
  image_url?: string | null;
  price_approx?: number | null;
  price_label?: string | null;
  cpu?: string | null;
  gpu?: string | null;
  gpu_vram_gb?: number | null;
  ram_gb?: number | null;
  storage_gb?: number | null;
  tier?: string | null;
  four_year_suitability?: string | null;
  priority_score?: number | null;
  availability?: string | null;
  feature_on_home?: boolean | null;
}

export interface HomePick extends HomePickCandidate {
  domain: DomainId;
  /** True when an admin forced this card in via `feature_on_home`. */
  pinned: boolean;
  /** Three-part spec line shown under the price, tailored to the domain. */
  specSummary: string;
}

export interface HomePickSlide {
  id: HomePickSlideId;
  /** Short label for the slide switcher. */
  label: string;
  title: string;
  blurb: string;
  picks: HomePick[];
}

// ── Tunable selection criteria ───────────────────────────────────────────────
// Everything an editor might want to adjust lives here rather than being
// scattered through the ranking functions.

/** Cards per domain, per slide. Three domains × 2 = a 6-card slide. */
export const PICKS_PER_DOMAIN = 2;

/**
 * Quality floor for the "Value for money" slide. The cheapest laptop in the
 * catalog is not automatically a good recommendation — without a floor the
 * landing page would advertise exactly the install-minimum machines the domain
 * rulebooks and FAQ copy warn students away from.
 *
 * Management tolerates 8GB because Office/BI coursework genuinely runs on it;
 * Design and Technology do not (containers, VMs, Adobe, 3D).
 */
export const VALUE_FLOOR_MIN_RAM_GB: Record<DomainId, number> = {
  design: 16,
  technology: 16,
  management: 8,
};

/** A laptop the admin has actively deprioritised should not headline the hub. */
export const VALUE_FLOOR_MIN_PRIORITY_SCORE = 40;

/**
 * Relative weight of each spec component in the "Power house" score, per
 * domain. Design leans GPU/VRAM, Technology leans RAM + CPU, and Management
 * almost ignores the GPU — matching the rulebooks' instruction not to charge
 * management students for graphics hardware their programmes never use.
 * Each row sums to 1.
 */
export const POWER_WEIGHTS: Record<
  DomainId,
  { gpu: number; cpu: number; ram: number; storage: number }
> = {
  design: { gpu: 0.4, cpu: 0.22, ram: 0.28, storage: 0.1 },
  technology: { gpu: 0.18, cpu: 0.32, ram: 0.38, storage: 0.12 },
  management: { gpu: 0.08, cpu: 0.37, ram: 0.37, storage: 0.18 },
};

const SLIDE_COPY: Record<HomePickSlideId, Pick<HomePickSlide, "label" | "title" | "blurb">> = {
  value: {
    label: "Value for money",
    title: "The most affordable pick in every field",
    blurb:
      "The lowest prices in the catalog that still clear our quality bar — cheap, but not a compromise you'll regret in year two.",
  },
  power: {
    label: "Power house",
    title: "The most capable machines we list",
    blurb:
      "Top of the range for each discipline, scored on the specs that field actually leans on — not on price tag alone.",
  },
};

const DOMAIN_SELECTION_ORDER: DomainId[] = ["design", "technology", "management"];

// ── Eligibility ──────────────────────────────────────────────────────────────

/**
 * Mirrors the out-of-stock test used by the price refresh flows. A laptop with
 * no availability string has simply never been checked, which is not the same
 * as being unavailable — those stay eligible.
 */
export function isUnavailable(availability: string | null | undefined): boolean {
  if (!availability) return false;
  const value = availability.toLowerCase();
  return (
    value.includes("unavailable") ||
    value.includes("out of stock") ||
    value.includes("not available")
  );
}

function isDomain(value: string | null | undefined): value is DomainId {
  return value === "design" || value === "technology" || value === "management";
}

/**
 * A card must have a real price — both slides are price claims, and a blank
 * price on the hub's most prominent section reads as broken.
 */
export function isPickEligible(laptop: HomePickCandidate): boolean {
  if (!isDomain(laptop.domain)) return false;
  if (typeof laptop.price_approx !== "number" || laptop.price_approx <= 0) return false;
  if (isUnavailable(laptop.availability)) return false;
  return true;
}

/** Quality bar a laptop must clear to headline the "Value for money" slide. */
export function clearsValueFloor(laptop: HomePickCandidate, domain: DomainId): boolean {
  if (laptop.four_year_suitability === "basic") return false;
  if ((laptop.priority_score ?? 50) < VALUE_FLOOR_MIN_PRIORITY_SCORE) return false;
  // Unknown RAM fails the floor: we cannot vouch for what we have not recorded.
  if ((laptop.ram_gb ?? 0) < VALUE_FLOOR_MIN_RAM_GB[domain]) return false;
  return true;
}

// ── Spec scoring ─────────────────────────────────────────────────────────────

/** Piecewise-linear mapping from a raw spec value onto a 0–100 scale. */
function interpolate(value: number, points: readonly (readonly [number, number])[]): number {
  const first = points[0];
  const last = points[points.length - 1];
  if (value <= first[0]) return first[1];
  if (value >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (value <= x1) return y0 + ((value - x0) / (x1 - x0)) * (y1 - y0);
  }
  return last[1];
}

const RAM_POINTS = [
  [8, 0],
  [16, 55],
  [24, 75],
  [32, 100],
] as const;

const STORAGE_POINTS = [
  [256, 0],
  [512, 45],
  [1024, 80],
  [2048, 100],
] as const;

const VRAM_POINTS = [
  [0, 0],
  [4, 30],
  [6, 50],
  [8, 75],
  [12, 95],
  [16, 100],
] as const;

/**
 * Rough CPU class from the marketing string. Ordered most- to least-specific so
 * "M3 Pro" matches the Apple pro tier before the bare M-series fallback.
 */
const CPU_STRENGTH_PATTERNS: readonly (readonly [RegExp, number])[] = [
  [/\bm\d+\s*(max|ultra)\b/i, 100],
  [/(ultra\s*9|core\s*i9|ryzen\s*9)/i, 100],
  [/\bm\d+\s*pro\b/i, 85],
  [/(ultra\s*7|core\s*i7|ryzen\s*7)/i, 75],
  [/(ultra\s*5|core\s*i5|ryzen\s*5)/i, 55],
  [/(core\s*i3|ryzen\s*3)/i, 30],
  [/(celeron|pentium|athlon)/i, 10],
  [/\bm\d+\b/i, 70],
];

export function cpuStrengthScore(cpu: string | null | undefined): number {
  if (!cpu) return 0;
  for (const [pattern, score] of CPU_STRENGTH_PATTERNS) {
    if (pattern.test(cpu)) return score;
  }
  return 40; // Known-but-unrecognised silicon sits mid-table, not at zero.
}

/**
 * 0–100 "how much machine is this" score, weighted for what the domain's
 * workloads actually stress. Used to rank the "Power house" slide, which is
 * deliberately *not* ordered by price — a thin premium ultrabook should not
 * outrank a cheaper RTX machine on a slide about capability.
 */
export function specPowerScore(laptop: HomePickCandidate, domain: DomainId): number {
  const weights = POWER_WEIGHTS[domain];
  // Blend the GPU model against its VRAM: the model name captures architecture,
  // VRAM captures the ceiling on 3D scenes and local AI models.
  const gpu =
    0.6 * getGpuStrengthScore(laptop.gpu) +
    0.4 * interpolate(laptop.gpu_vram_gb ?? 0, VRAM_POINTS);
  const cpu = cpuStrengthScore(laptop.cpu);
  const ram = interpolate(laptop.ram_gb ?? 0, RAM_POINTS);
  const storage = interpolate(laptop.storage_gb ?? 0, STORAGE_POINTS);
  return (
    weights.gpu * gpu + weights.cpu * cpu + weights.ram * ram + weights.storage * storage
  );
}

// ── Display helpers ──────────────────────────────────────────────────────────

function shortGpu(gpu: string | null | undefined): string | null {
  if (!gpu) return null;
  const discrete = gpu.match(/(rtx|gtx)\s*(\d{4})\s*(ti)?/i);
  if (discrete) {
    const suffix = discrete[3] ? " Ti" : "";
    return `${discrete[1].toUpperCase()} ${discrete[2]}${suffix}`;
  }
  if (/integrated|iris|uhd|vega|radeon graphics/i.test(gpu)) return "Integrated graphics";
  return gpu.length > 22 ? null : gpu;
}

function shortCpu(cpu: string | null | undefined): string | null {
  if (!cpu) return null;
  const ultra = cpu.match(/core\s*ultra\s*(\d)/i);
  if (ultra) return `Core Ultra ${ultra[1]}`;
  const intel = cpu.match(/core\s*i(\d)/i);
  if (intel) return `Core i${intel[1]}`;
  const ryzen = cpu.match(/ryzen\s*(\d)/i);
  if (ryzen) return `Ryzen ${ryzen[1]}`;
  const apple = cpu.match(/\b(m\d+)\s*(pro|max|ultra)?\b/i);
  if (apple) {
    const suffix = apple[2];
    const variant = suffix
      ? ` ${suffix[0].toUpperCase()}${suffix.slice(1).toLowerCase()}`
      : "";
    return `${apple[1].toUpperCase()}${variant}`;
  }
  return cpu.length > 22 ? null : cpu;
}

function formatStorage(gb: number | null | undefined): string | null {
  if (!gb || gb <= 0) return null;
  return gb >= 1024 ? `${Math.round((gb / 1024) * 10) / 10}TB SSD` : `${gb}GB SSD`;
}

/**
 * Three-part spec line. Design and Technology lead with the GPU because that is
 * the spec their audiences shop on; Management leads with the CPU, since a
 * discrete GPU is beside the point for spreadsheets and BI tools.
 */
export function buildSpecSummary(laptop: HomePickCandidate, domain: DomainId): string {
  const lead = domain === "management" ? shortCpu(laptop.cpu) : shortGpu(laptop.gpu);
  const parts = [
    lead,
    laptop.ram_gb ? `${laptop.ram_gb}GB RAM` : null,
    formatStorage(laptop.storage_gb),
  ].filter((part): part is string => Boolean(part));
  return parts.join(" · ");
}

// ── Ranking ──────────────────────────────────────────────────────────────────

// Every comparator ends on `slug` so the carousel is stable across renders when
// two laptops tie on everything else.
function compareValue(a: HomePickCandidate, b: HomePickCandidate): number {
  const price = (a.price_approx ?? 0) - (b.price_approx ?? 0);
  if (price !== 0) return price;
  const priority = (b.priority_score ?? 50) - (a.priority_score ?? 50);
  if (priority !== 0) return priority;
  return a.slug.localeCompare(b.slug);
}

function comparePower(domain: DomainId) {
  return (a: HomePickCandidate, b: HomePickCandidate): number => {
    const score = specPowerScore(b, domain) - specPowerScore(a, domain);
    if (Math.abs(score) > 0.001) return score;
    const priority = (b.priority_score ?? 50) - (a.priority_score ?? 50);
    if (priority !== 0) return priority;
    const price = (b.price_approx ?? 0) - (a.price_approx ?? 0);
    if (price !== 0) return price;
    return a.slug.localeCompare(b.slug);
  };
}

/** Position within an ordering, normalised to 0 (best) … 1 (worst). */
function percentile(index: number, total: number): number {
  return total <= 1 ? 0 : index / (total - 1);
}

interface DomainSelection {
  value: HomePickCandidate[];
  power: HomePickCandidate[];
}

/**
 * Picks this domain's cards for both slides.
 *
 * A laptop belongs to whichever slide it makes the stronger claim on — its
 * better percentile rank between "cheapest" and "most capable". That single
 * rule does three jobs at once: it stops the same laptop appearing twice, it
 * decides where an admin pin lands without asking the admin to choose a slide,
 * and it keeps a small catalog's cheapest machine off the Power house slide.
 */
function selectForDomain(
  eligible: HomePickCandidate[],
  domain: DomainId,
  perDomain: number
): DomainSelection {
  // Pins bypass the value floor — an explicit admin decision outranks the
  // heuristic — but never the eligibility rules (published, priced, in stock).
  const valueOrder = eligible
    .filter((l) => l.feature_on_home || clearsValueFloor(l, domain))
    .sort(compareValue);
  const powerOrder = [...eligible].sort(comparePower(domain));

  const valueIndex = new Map(valueOrder.map((l, i) => [l.id, i]));
  const powerIndex = new Map(powerOrder.map((l, i) => [l.id, i]));

  const claimedSlide = (laptop: HomePickCandidate): HomePickSlideId => {
    const vi = valueIndex.get(laptop.id);
    if (vi === undefined) return "power"; // Failed the value floor.
    const pi = powerIndex.get(laptop.id) ?? powerOrder.length;
    return percentile(vi, valueOrder.length) < percentile(pi, powerOrder.length)
      ? "value"
      : "power";
  };

  const selection: DomainSelection = { value: [], power: [] };
  const used = new Set<string>();

  const take = (slide: HomePickSlideId, laptop: HomePickCandidate): boolean => {
    if (used.has(laptop.id) || selection[slide].length >= perDomain) return false;
    selection[slide].push(laptop);
    used.add(laptop.id);
    return true;
  };

  // Pass 1 — pins claim a slot first, falling back to the other slide if their
  // preferred one is already full of pins.
  for (const laptop of powerOrder.filter((l) => l.feature_on_home)) {
    const preferred = claimedSlide(laptop);
    const fallback: HomePickSlideId = preferred === "value" ? "power" : "value";
    if (!take(preferred, laptop)) take(fallback, laptop);
  }

  // Pass 2 — fill each slide from the laptops that belong to it.
  for (const slide of ["value", "power"] as const) {
    const order = slide === "value" ? valueOrder : powerOrder;
    for (const laptop of order) {
      if (selection[slide].length >= perDomain) break;
      if (claimedSlide(laptop) === slide) take(slide, laptop);
    }
  }

  // Pass 3 — backfill any slot still empty, still respecting the value floor
  // (valueOrder already excludes laptops that fail it).
  for (const slide of ["value", "power"] as const) {
    const order = slide === "value" ? valueOrder : powerOrder;
    for (const laptop of order) {
      if (selection[slide].length >= perDomain) break;
      take(slide, laptop);
    }
  }

  selection.value.sort(compareValue);
  selection.power.sort(comparePower(domain));
  return selection;
}

function toPick(laptop: HomePickCandidate, domain: DomainId): HomePick {
  return {
    ...laptop,
    domain,
    pinned: Boolean(laptop.feature_on_home),
    specSummary: buildSpecSummary(laptop, domain),
  };
}

/**
 * Builds the carousel's slides from the published catalog.
 *
 * Slides are dropped entirely when they have no cards, and a domain that is
 * flag-disabled or short on qualifying laptops simply contributes fewer cards —
 * we never pad a slide with a laptop that failed its criteria.
 */
export function selectHomePicks(
  candidates: readonly HomePickCandidate[],
  options: { domains: readonly DomainId[]; perDomain?: number }
): HomePickSlide[] {
  const perDomain = options.perDomain ?? PICKS_PER_DOMAIN;
  const enabled = new Set(options.domains);
  const eligible = candidates.filter(isPickEligible);

  const slides: Record<HomePickSlideId, HomePick[]> = { value: [], power: [] };

  // Grouped by domain in a fixed order so each slide reads Design → Technology
  // → Management rather than shuffling between renders.
  for (const domain of DOMAIN_SELECTION_ORDER) {
    if (!enabled.has(domain)) continue;
    const forDomain = eligible.filter((l) => l.domain === domain);
    if (forDomain.length === 0) continue;
    const selection = selectForDomain(forDomain, domain, perDomain);
    slides.value.push(...selection.value.map((l) => toPick(l, domain)));
    slides.power.push(...selection.power.map((l) => toPick(l, domain)));
  }

  return (["value", "power"] as const)
    .filter((id) => slides[id].length > 0)
    .map((id) => ({ id, ...SLIDE_COPY[id], picks: slides[id] }));
}
