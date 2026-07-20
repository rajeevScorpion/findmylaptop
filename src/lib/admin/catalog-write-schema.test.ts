import { describe, expect, it } from "vitest";
import {
  courseMutationSchema,
  laptopMutationSchema,
  refreshPricesRequestSchema,
} from "./catalog-write-schema";

function validLaptopSave() {
  return {
    action: "save" as const,
    laptopId: null,
    values: {
      name: "Example Laptop 14",
      domain: "design" as const,
      brand: "Example",
      model: "14",
      price_approx: 79990,
      price_label: "₹79,990",
      amazon_affiliate_url: "https://www.amazon.in/dp/B0ABCDEF12",
      asin: "B0ABCDEF12",
      image_url: "https://example.com/laptop.jpg",
      cpu: "Example CPU",
      gpu: null,
      gpu_vram_gb: null,
      ram: "16 GB",
      ram_gb: 16,
      storage: "512 GB SSD",
      storage_gb: 512,
      display: "14-inch IPS",
      weight: "1.4 kg",
      os: "Windows 11",
      tier: "balanced" as const,
      workload_tags: ["portable"],
      recommended_for_courses: ["Communication Design"],
      not_ideal_for: [],
      why_recommended: "A bounded recommendation.",
      cautions: null,
      upgrade_notes: null,
      four_year_suitability: "good" as const,
      priority_score: 50,
      is_published: false,
      raw_input: null,
    },
  };
}

describe("laptopMutationSchema", () => {
  it("accepts a bounded full save", () => {
    expect(laptopMutationSchema.safeParse(validLaptopSave()).success).toBe(true);
  });

  it("rejects browser-owned IDs, slugs, and creator identity", () => {
    const mutation = validLaptopSave();
    const forged = {
      ...mutation,
      values: {
        ...mutation.values,
        id: "10000000-0000-4000-8000-000000000001",
        slug: "browser-forged",
        created_by: "attacker@example.com",
      },
    };
    expect(laptopMutationSchema.safeParse(forged).success).toBe(false);
  });

  it("rejects generic patches and oversized source text", () => {
    expect(
      laptopMutationSchema.safeParse({
        action: "set_published",
        laptopId: "10000000-0000-4000-8000-000000000001",
        value: true,
        price_approx: 1,
      }).success
    ).toBe(false);

    const base = validLaptopSave();
    const oversized = {
      ...base,
      values: { ...base.values, raw_input: "x".repeat(100_001) },
    };
    expect(laptopMutationSchema.safeParse(oversized).success).toBe(false);
  });
});

describe("courseMutationSchema", () => {
  it("accepts the explicit taxonomy operations only", () => {
    expect(
      courseMutationSchema.safeParse({
        action: "add",
        domain: "technology",
        category: "Data & AI",
        name: "Data Science",
      }).success
    ).toBe(true);
    expect(
      courseMutationSchema.safeParse({
        action: "add",
        domain: "technology",
        category: "Data & AI",
        name: "Data Science",
        workload_level: "heavy",
      }).success
    ).toBe(false);
  });
});

describe("refreshPricesRequestSchema", () => {
  it("bounds and validates requested laptop IDs", () => {
    expect(refreshPricesRequestSchema.safeParse({}).success).toBe(true);
    expect(
      refreshPricesRequestSchema.safeParse({ ids: ["not-a-uuid"] }).success
    ).toBe(false);
    expect(
      refreshPricesRequestSchema.safeParse({
        ids: Array.from(
          { length: 101 },
          (_, index) => `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`
        ),
      }).success
    ).toBe(false);
  });
});
