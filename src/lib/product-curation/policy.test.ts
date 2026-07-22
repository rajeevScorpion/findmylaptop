import { describe, expect, it } from "vitest";

import { auditCatalog, evaluateLaptopPolicy, laptopFingerprint } from "./policy";
import type { CatalogLaptopSnapshot, CompiledRulebook } from "./types";

const hardware = {
  minimumRamGb: 16,
  minimumStorageGb: 512,
  minimumGpuVramGb: null,
  requiresDedicatedGpu: null,
  maximumWeightKg: null,
  requiredCpuTerms: [],
  requiredGpuTerms: [],
  avoidTerms: [],
};

const rulebook: CompiledRulebook = {
  summary: "A conservative test rulebook for course coverage and product selection.",
  targetRecommendationsPerCourse: 2,
  generalHardware: hardware,
  preferredCpuTerms: [],
  preferredGpuTerms: [],
  preferredDisplayTerms: [],
  coursePolicies: [],
  searchStrategies: [{ keywords: "student laptop 16GB 512GB", portfolioRole: "best_overall", courseNames: ["UX Design"], rationale: "Fill the verified UX Design coverage gap." }],
};

function laptop(input: Partial<CatalogLaptopSnapshot> & Pick<CatalogLaptopSnapshot, "id" | "name">): CatalogLaptopSnapshot {
  return {
    id: input.id,
    domain: "design",
    name: input.name,
    brand: input.brand ?? "Example",
    model: input.model ?? input.name,
    asin: input.asin ?? null,
    cpu: input.cpu ?? "Core Ultra 5",
    gpu: input.gpu ?? "Integrated graphics",
    gpu_vram_gb: input.gpu_vram_gb ?? null,
    ram_gb: input.ram_gb ?? 16,
    storage_gb: input.storage_gb ?? 512,
    display: input.display ?? "14 inch IPS",
    weight: input.weight ?? "1.4 kg",
    price_approx: input.price_approx ?? 80_000,
    tier: input.tier ?? "mid-range",
    recommended_for_courses: input.recommended_for_courses ?? [],
    is_published: input.is_published ?? true,
    priority_score: input.priority_score ?? 70,
    last_checked: input.last_checked ?? "2026-07-22",
  };
}

function audit(laptops: CatalogLaptopSnapshot[], pendingCandidateCount = 0, maxDomainRecommendations = 8) {
  return auditCatalog({
    domain: "design",
    rulebook,
    courses: [{ id: "course-1", domain: "design", category: "Design", name: "UX Design", workload_level: "balanced" }],
    laptops,
    pendingCandidateCount,
    maxDomainRecommendations,
    maxCourseRecommendations: 3,
  });
}

describe("deterministic product curation policy", () => {
  it("fails closed when required hardware is missing", () => {
    expect(evaluateLaptopPolicy(laptop({ id: "low", name: "Low memory", ram_gb: 8 }), hardware)).toMatchObject({
      pass: false,
      reasons: ["RAM is below 16 GB."],
    });
  });

  it("reuses a suitable catalog laptop before allowing marketplace discovery", () => {
    const result = audit([
      laptop({ id: "mapped", name: "Mapped", recommended_for_courses: ["UX Design"] }),
      laptop({ id: "reusable", name: "Reusable", recommended_for_courses: [] }),
    ]);

    expect(result.findings).toContainEqual(expect.objectContaining({ laptopId: "reusable", decision: "add" }));
    expect(result.gaps[0].missingCount).toBe(0);
    expect(result.searchAllowed).toBe(false);
  });

  it("routes a suitable unpublished laptop to admin review instead of searching for another option", () => {
    const result = audit([
      laptop({ id: "published", name: "Published", recommended_for_courses: ["UX Design"] }),
      laptop({ id: "draft", name: "Draft", is_published: false, recommended_for_courses: [] }),
    ]);

    expect(result.findings).toContainEqual(expect.objectContaining({ laptopId: "draft", decision: "add" }));
    expect(result.findings).toContainEqual(expect.objectContaining({ laptopId: "draft", decision: "review", courseId: null }));
    expect(result.gaps[0].missingCount).toBe(0);
    expect(result.searchAllowed).toBe(false);
  });

  it("removes invalid mappings and permits one bounded search only for a real remaining gap", () => {
    const result = audit([
      laptop({ id: "weak", name: "Weak", ram_gb: 8, recommended_for_courses: ["UX Design"] }),
    ]);

    expect(result.findings).toContainEqual(expect.objectContaining({ laptopId: "weak", decision: "remove" }));
    expect(result.gaps[0].missingCount).toBe(2);
    expect(result.searchAllowed).toBe(true);
  });

  it("blocks discovery at either the catalog cap or the pending-decision cap", () => {
    expect(audit([laptop({ id: "one", name: "One" })], 0, 1).searchAllowed).toBe(false);
    expect(audit([], 3).searchAllowed).toBe(false);
  });

  it("uses every known configuration fingerprint, not only already duplicated rows", () => {
    const existing = laptop({ id: "one", name: "Model A", brand: "Brand", model: "A", ram_gb: 16, storage_gb: 512 });
    const result = audit([existing]);
    expect(result.knownFingerprints).toContain(laptopFingerprint(existing));
    expect(result.duplicateFingerprints).toEqual([]);
  });
});
