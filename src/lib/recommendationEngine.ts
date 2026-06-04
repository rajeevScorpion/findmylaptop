import type { Laptop, FilterState, RecommendationResult, BadgeType, SortOption } from "./types";
import { getGpuStrengthScore, COURSES_BY_CATEGORY } from "./constants";

const FOUR_YEAR_SCORES: Record<string, number> = {
  excellent: 4,
  strong: 3,
  good: 2,
  basic: 1,
};

function computeSuitabilityScore(laptop: Laptop, filters: FilterState): number {
  let score = laptop.priority_score ?? 50;

  // Course match
  if (
    filters.course &&
    laptop.recommended_for_courses.some(
      (c) => c.toLowerCase() === filters.course!.toLowerCase()
    )
  ) {
    score += 20;
  }

  // Workload tag overlap
  if (filters.workloadTags && filters.workloadTags.length > 0) {
    const overlap = laptop.workload_tags.filter((t) =>
      filters.workloadTags.includes(t)
    ).length;
    score += overlap * 5;
  }

  // RAM adequacy
  if (filters.minRamGb && laptop.ram_gb) {
    if (laptop.ram_gb >= filters.minRamGb) score += 10;
    else score -= 15;
  }

  // VRAM adequacy
  if (filters.minVramGb && laptop.gpu_vram_gb) {
    if (laptop.gpu_vram_gb >= filters.minVramGb) score += 10;
    else score -= 15;
  }

  // Budget fit
  if (filters.maxBudget && laptop.price_approx) {
    if (laptop.price_approx <= filters.maxBudget) {
      score += 10;
    } else {
      score -= 20;
    }
  }

  // Tier match
  if (filters.tier && laptop.tier === filters.tier) {
    score += 8;
  }

  return score;
}

function computeBadges(laptop: Laptop, allLaptops: Laptop[]): BadgeType[] {
  const badges: BadgeType[] = [];

  // Best Value: good GPU VRAM at lower price
  const avgPrice =
    allLaptops
      .filter((l) => l.price_approx)
      .reduce((sum, l) => sum + (l.price_approx ?? 0), 0) /
    Math.max(allLaptops.filter((l) => l.price_approx).length, 1);

  if (
    laptop.price_approx &&
    laptop.price_approx < avgPrice * 0.85 &&
    (laptop.gpu_vram_gb ?? 0) >= 6
  ) {
    badges.push("Best Value");
  }

  // Future Ready: excellent 4-year suitability or heavy workload capability
  if (
    laptop.four_year_suitability === "excellent" ||
    laptop.four_year_suitability === "strong"
  ) {
    badges.push("Future Ready");
  }

  // Heavy 3D: high VRAM + workload tags
  if (
    (laptop.gpu_vram_gb ?? 0) >= 8 &&
    (laptop.workload_tags.includes("3d") ||
      laptop.workload_tags.includes("rendering") ||
      laptop.workload_tags.includes("animation"))
  ) {
    badges.push("Heavy 3D");
  }

  // AI Ready: VRAM 8GB+ and AI workload tag
  if (
    (laptop.gpu_vram_gb ?? 0) >= 8 &&
    laptop.workload_tags.includes("ai")
  ) {
    badges.push("AI Ready");
  }

  // Portable Choice: weight indicator in name/display or explicit light tier
  if (
    laptop.tier === "budget" &&
    laptop.price_approx &&
    laptop.price_approx < 70000
  ) {
    badges.push("Budget Conscious");
  }

  return badges;
}

function matchesSearch(laptop: Laptop, query: string): boolean {
  if (!query.trim()) return true;
  const lower = query.toLowerCase();
  return (
    (laptop.name?.toLowerCase().includes(lower) ?? false) ||
    (laptop.brand?.toLowerCase().includes(lower) ?? false) ||
    (laptop.cpu?.toLowerCase().includes(lower) ?? false) ||
    (laptop.gpu?.toLowerCase().includes(lower) ?? false) ||
    laptop.recommended_for_courses.some((c) =>
      c.toLowerCase().includes(lower)
    ) ||
    laptop.workload_tags.some((t) => t.toLowerCase().includes(lower))
  );
}

function sortResults(
  results: RecommendationResult[],
  sort: SortOption
): RecommendationResult[] {
  const sorted = [...results];

  switch (sort) {
    case "recommended":
      return sorted.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

    case "price-asc":
      return sorted.sort(
        (a, b) => (a.price_approx ?? 999999) - (b.price_approx ?? 999999)
      );

    case "price-desc":
      return sorted.sort(
        (a, b) => (b.price_approx ?? 0) - (a.price_approx ?? 0)
      );

    case "gpu-strength":
      return sorted.sort(
        (a, b) => getGpuStrengthScore(b.gpu) - getGpuStrengthScore(a.gpu)
      );

    case "four-year":
      return sorted.sort(
        (a, b) =>
          (FOUR_YEAR_SCORES[b.four_year_suitability ?? "basic"] ?? 0) -
          (FOUR_YEAR_SCORES[a.four_year_suitability ?? "basic"] ?? 0)
      );

    default:
      return sorted;
  }
}

export function getRecommendations(
  laptops: Laptop[],
  filters: FilterState,
  sort: SortOption = "recommended"
): RecommendationResult[] {
  const filtered = laptops.filter((laptop) => {
    // Text search
    if (!matchesSearch(laptop, filters.searchQuery)) return false;

    // Course hard filter — specific course selected
    if (filters.course) {
      const matches = laptop.recommended_for_courses.some(
        (c) => c.toLowerCase() === filters.course!.toLowerCase()
      );
      if (!matches) return false;
    } else if (filters.courseCategory) {
      // Only category selected — match any course in that category
      const categoryCourses = (COURSES_BY_CATEGORY[filters.courseCategory] ?? []).map(
        (c) => c.toLowerCase()
      );
      const matches = laptop.recommended_for_courses.some((c) =>
        categoryCourses.includes(c.toLowerCase())
      );
      if (!matches) return false;
    }

    // Budget filter
    if (
      filters.maxBudget &&
      filters.maxBudget < 999999 &&
      laptop.price_approx &&
      laptop.price_approx > filters.maxBudget * 1.1
    ) {
      return false;
    }

    // RAM filter
    if (
      filters.minRamGb &&
      laptop.ram_gb &&
      laptop.ram_gb < filters.minRamGb
    ) {
      return false;
    }

    // VRAM filter
    if (
      filters.minVramGb &&
      laptop.gpu_vram_gb &&
      laptop.gpu_vram_gb < filters.minVramGb
    ) {
      return false;
    }

    // Tier filter
    if (filters.tier && laptop.tier && laptop.tier !== filters.tier) {
      return false;
    }

    // Brand filter
    if (
      filters.brand &&
      laptop.brand?.toLowerCase() !== filters.brand.toLowerCase()
    ) {
      return false;
    }

    // Processor type filter
    if (filters.processorType && laptop.cpu) {
      const cpu = laptop.cpu.toLowerCase();
      const match =
        (filters.processorType === "intel" && cpu.includes("intel")) ||
        (filters.processorType === "amd" && cpu.includes("amd")) ||
        (filters.processorType === "apple" && (cpu.includes("apple") || cpu.includes(" m1") || cpu.includes(" m2") || cpu.includes(" m3") || cpu.includes(" m4")));
      if (!match) return false;
    }

    return true;
  });

  const results: RecommendationResult[] = filtered.map((laptop) => ({
    ...laptop,
    suitabilityScore: computeSuitabilityScore(laptop, filters),
    badges: computeBadges(laptop, laptops),
  }));

  return sortResults(results, sort);
}

export function generateSlug(name: string, id?: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  return id ? `${base}-${id.slice(0, 8)}` : base;
}
