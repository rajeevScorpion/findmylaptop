import { describe, expect, it } from "vitest";
import {
  buildSpecSummary,
  clearsValueFloor,
  cpuStrengthScore,
  isPickEligible,
  isUnavailable,
  selectHomePicks,
  specPowerScore,
  type HomePickCandidate,
} from "./home-picks";

function laptop(overrides: Partial<HomePickCandidate> & { slug: string }): HomePickCandidate {
  return {
    id: overrides.slug,
    domain: "design",
    name: overrides.slug,
    price_approx: 90000,
    cpu: "Intel Core i7-13650HX",
    gpu: "NVIDIA GeForce RTX 4060 8GB",
    gpu_vram_gb: 8,
    ram_gb: 16,
    storage_gb: 512,
    tier: "balanced",
    four_year_suitability: "strong",
    priority_score: 60,
    availability: "In stock",
    feature_on_home: false,
    ...overrides,
  };
}

// A four-laptop design catalog spanning the price/power range, used by most of
// the selection tests below.
const DESIGN_CATALOG: HomePickCandidate[] = [
  laptop({
    slug: "d-cheap",
    price_approx: 55_000,
    cpu: "Intel Core i5-13420H",
    gpu: "Intel Iris Xe",
    gpu_vram_gb: null,
    four_year_suitability: "good",
  }),
  laptop({
    slug: "d-mid",
    price_approx: 85_000,
    gpu: "NVIDIA GeForce RTX 4050 6GB",
    gpu_vram_gb: 6,
  }),
  laptop({
    slug: "d-power2",
    price_approx: 130_000,
    cpu: "Intel Core i7-14650HX",
    ram_gb: 32,
    storage_gb: 1024,
    four_year_suitability: "excellent",
  }),
  laptop({
    slug: "d-power",
    price_approx: 150_000,
    cpu: "Intel Core i9-14900HX",
    gpu: "NVIDIA GeForce RTX 4070 8GB",
    ram_gb: 32,
    storage_gb: 1024,
    four_year_suitability: "excellent",
  }),
];

const slugsFor = (
  slides: ReturnType<typeof selectHomePicks>,
  id: "value" | "power"
): string[] => slides.find((s) => s.id === id)?.picks.map((p) => p.slug) ?? [];

describe("isUnavailable", () => {
  it("treats a never-checked laptop as available", () => {
    expect(isUnavailable(null)).toBe(false);
    expect(isUnavailable(undefined)).toBe(false);
  });

  it("recognises the retailer's out-of-stock phrasings", () => {
    expect(isUnavailable("Currently unavailable")).toBe(true);
    expect(isUnavailable("Out of Stock")).toBe(true);
    expect(isUnavailable("Not available")).toBe(true);
    expect(isUnavailable("In stock")).toBe(false);
  });
});

describe("isPickEligible", () => {
  it("accepts a priced, in-stock laptop in a known domain", () => {
    expect(isPickEligible(laptop({ slug: "ok" }))).toBe(true);
  });

  it("rejects laptops the carousel cannot honestly present", () => {
    expect(isPickEligible(laptop({ slug: "no-price", price_approx: null }))).toBe(false);
    expect(isPickEligible(laptop({ slug: "zero-price", price_approx: 0 }))).toBe(false);
    expect(
      isPickEligible(laptop({ slug: "gone", availability: "Currently unavailable" }))
    ).toBe(false);
    expect(isPickEligible(laptop({ slug: "no-domain", domain: null }))).toBe(false);
  });
});

describe("clearsValueFloor", () => {
  it("rejects a laptop our own copy warns students away from", () => {
    expect(
      clearsValueFloor(laptop({ slug: "basic", four_year_suitability: "basic" }), "design")
    ).toBe(false);
    expect(clearsValueFloor(laptop({ slug: "low", priority_score: 20 }), "design")).toBe(
      false
    );
  });

  it("holds design and technology to 16GB but lets management run on 8GB", () => {
    const eightGb = laptop({ slug: "8gb", ram_gb: 8 });
    expect(clearsValueFloor(eightGb, "design")).toBe(false);
    expect(clearsValueFloor(eightGb, "technology")).toBe(false);
    expect(clearsValueFloor(eightGb, "management")).toBe(true);
  });

  it("fails a laptop whose RAM was never recorded", () => {
    expect(clearsValueFloor(laptop({ slug: "unknown", ram_gb: null }), "design")).toBe(false);
  });
});

describe("cpuStrengthScore", () => {
  it("orders the common Intel and AMD tiers", () => {
    expect(cpuStrengthScore("Intel Core i9-14900HX")).toBeGreaterThan(
      cpuStrengthScore("Intel Core i7-13650HX")
    );
    expect(cpuStrengthScore("AMD Ryzen 7 7840HS")).toBeGreaterThan(
      cpuStrengthScore("AMD Ryzen 5 7535HS")
    );
    expect(cpuStrengthScore("Intel Celeron N4020")).toBeLessThan(
      cpuStrengthScore("Intel Core i3-1215U")
    );
  });

  it("ranks Apple Pro/Max silicon above the base M-series", () => {
    expect(cpuStrengthScore("Apple M3 Max")).toBeGreaterThan(cpuStrengthScore("Apple M3 Pro"));
    expect(cpuStrengthScore("Apple M3 Pro")).toBeGreaterThan(cpuStrengthScore("Apple M3"));
  });

  it("scores an unknown CPU mid-table rather than at zero", () => {
    expect(cpuStrengthScore("Snapdragon X Elite")).toBe(40);
    expect(cpuStrengthScore(null)).toBe(0);
  });
});

describe("specPowerScore", () => {
  const withGpu = laptop({ slug: "gpu" });
  const withoutGpu = laptop({ slug: "no-gpu", gpu: null, gpu_vram_gb: null });

  it("weights the GPU far more heavily for design than for management", () => {
    const designGap = specPowerScore(withGpu, "design") - specPowerScore(withoutGpu, "design");
    const managementGap =
      specPowerScore(withGpu, "management") - specPowerScore(withoutGpu, "management");
    expect(designGap).toBeGreaterThan(managementGap * 4);
  });

  it("lets a high-RAM office machine outrank a gaming laptop for management", () => {
    const office = laptop({
      slug: "office",
      gpu: null,
      gpu_vram_gb: null,
      ram_gb: 32,
      storage_gb: 1024,
    });
    const gaming = laptop({ slug: "gaming", ram_gb: 8, cpu: "Intel Core i5-13420H" });
    expect(specPowerScore(office, "management")).toBeGreaterThan(
      specPowerScore(gaming, "management")
    );
  });

  it("ranks a current-generation GPU above the one it replaced", () => {
    const rtx5070ti = laptop({ slug: "5070ti", gpu: "NVIDIA GeForce RTX 5070 Ti 12GB", gpu_vram_gb: 12 });
    const rtx4080 = laptop({ slug: "4080", gpu: "NVIDIA GeForce RTX 4080 12GB", gpu_vram_gb: 12 });
    const rtx3060 = laptop({ slug: "3060", gpu: "NVIDIA GeForce RTX 3060 6GB", gpu_vram_gb: 6 });
    expect(specPowerScore(rtx5070ti, "design")).toBeGreaterThan(
      specPowerScore(rtx4080, "design")
    );
    expect(specPowerScore(rtx4080, "design")).toBeGreaterThan(
      specPowerScore(rtx3060, "design")
    );
  });

  it("rewards more VRAM at the same GPU tier", () => {
    const eight = laptop({ slug: "8gb-vram", gpu_vram_gb: 8 });
    const six = laptop({ slug: "6gb-vram", gpu_vram_gb: 6 });
    expect(specPowerScore(eight, "design")).toBeGreaterThan(specPowerScore(six, "design"));
  });
});

describe("buildSpecSummary", () => {
  it("leads with the GPU for design", () => {
    expect(buildSpecSummary(laptop({ slug: "d" }), "design")).toBe(
      "RTX 4060 · 16GB RAM · 512GB SSD"
    );
  });

  it("keeps the Ti suffix readable rather than shouting it", () => {
    expect(
      buildSpecSummary(
        laptop({ slug: "ti", gpu: "NVIDIA GeForce RTX 5070 Ti 12GB", storage_gb: 1024 }),
        "design"
      )
    ).toBe("RTX 5070 Ti · 16GB RAM · 1TB SSD");
  });

  it("leads with the CPU for management, where a discrete GPU is beside the point", () => {
    expect(buildSpecSummary(laptop({ slug: "m", storage_gb: 1024 }), "management")).toBe(
      "Core i7 · 16GB RAM · 1TB SSD"
    );
  });

  it("skips specs that were never recorded", () => {
    expect(
      buildSpecSummary(
        laptop({ slug: "sparse", gpu: null, gpu_vram_gb: null, storage_gb: null }),
        "design"
      )
    ).toBe("16GB RAM");
  });
});

describe("selectHomePicks", () => {
  it("sends the cheapest to Value and the most capable to Power house", () => {
    const slides = selectHomePicks(DESIGN_CATALOG, { domains: ["design"] });
    expect(slugsFor(slides, "value")).toEqual(["d-cheap", "d-mid"]);
    expect(slugsFor(slides, "power")).toEqual(["d-power", "d-power2"]);
  });

  it("never shows the same laptop on both slides", () => {
    const slides = selectHomePicks(DESIGN_CATALOG, { domains: ["design"] });
    const all = slides.flatMap((s) => s.picks.map((p) => p.slug));
    expect(new Set(all).size).toBe(all.length);
  });

  it("keeps a below-floor bargain out of the carousel entirely", () => {
    const withJunk = [
      ...DESIGN_CATALOG,
      laptop({ slug: "d-junk", price_approx: 40_000, ram_gb: 8, four_year_suitability: "basic" }),
    ];
    const slides = selectHomePicks(withJunk, { domains: ["design"] });
    expect(slides.flatMap((s) => s.picks.map((p) => p.slug))).not.toContain("d-junk");
  });

  it("lets an admin pin override the value floor", () => {
    const pinned = laptop({
      slug: "d-pinned",
      price_approx: 40_000,
      ram_gb: 8,
      four_year_suitability: "basic",
      feature_on_home: true,
    });
    const slides = selectHomePicks([...DESIGN_CATALOG, pinned], { domains: ["design"] });
    const value = slugsFor(slides, "value");
    expect(value).toContain("d-pinned");
    expect(value).toHaveLength(2);
    expect(slides.find((s) => s.id === "value")?.picks[0].pinned).toBe(true);
  });

  it("caps each domain at two cards per slide and orders domains consistently", () => {
    const catalog = [
      ...DESIGN_CATALOG,
      ...DESIGN_CATALOG.map((l, i) =>
        laptop({ ...l, slug: `t-${i}`, id: `t-${i}`, domain: "technology" })
      ),
    ];
    const slides = selectHomePicks(catalog, { domains: ["design", "technology"] });
    for (const slide of slides) {
      expect(slide.picks).toHaveLength(4);
      expect(slide.picks.slice(0, 2).every((p) => p.domain === "design")).toBe(true);
      expect(slide.picks.slice(2).every((p) => p.domain === "technology")).toBe(true);
    }
  });

  it("ignores domains that are not flag-enabled", () => {
    const catalog = [
      ...DESIGN_CATALOG,
      laptop({ slug: "m-1", id: "m-1", domain: "management" }),
    ];
    const slides = selectHomePicks(catalog, { domains: ["design"] });
    expect(slides.flatMap((s) => s.picks.map((p) => p.domain))).not.toContain("management");
  });

  it("drops a slide that has no cards rather than rendering it empty", () => {
    const soleLaptop = [laptop({ slug: "only", price_approx: 60_000 })];
    const slides = selectHomePicks(soleLaptop, { domains: ["design"] });
    expect(slides).toHaveLength(1);
    expect(slides[0].picks.map((p) => p.slug)).toEqual(["only"]);
  });

  it("returns nothing when the catalog has no eligible laptops", () => {
    const unpriced = [laptop({ slug: "no-price", price_approx: null })];
    expect(selectHomePicks(unpriced, { domains: ["design"] })).toEqual([]);
  });

  it("is stable across repeated runs of the same catalog", () => {
    const first = selectHomePicks(DESIGN_CATALOG, { domains: ["design"] });
    const second = selectHomePicks([...DESIGN_CATALOG].reverse(), { domains: ["design"] });
    expect(slugsFor(second, "value")).toEqual(slugsFor(first, "value"));
    expect(slugsFor(second, "power")).toEqual(slugsFor(first, "power"));
  });
});
