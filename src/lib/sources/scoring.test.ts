import { describe, expect, it } from "vitest";

import { assessCandidate, isPriceDisplayable } from "./scoring";
import type { NormalizedLaptop } from "./types";

type AssessableProduct = Omit<
  NormalizedLaptop,
  | "fitTags"
  | "riskTags"
  | "confidenceScore"
  | "fitScore"
  | "complianceStatus"
>;

function product(overrides: Partial<AssessableProduct> = {}): AssessableProduct {
  return {
    sourceKey: "manual",
    title: "Evidence-only laptop listing",
    priceFreshness: "not_provided",
    url: "https://catalog.example/laptops/evidence-only",
    fetchedAt: "2026-07-16T11:55:00.000Z",
    ...overrides,
  };
}

describe("candidate assessment", () => {
  it("rewards a complete, compliant candidate without adding risk tags", () => {
    const result = assessCandidate(
      product({
        sourceKey: "amazon",
        sourceProductId: "ASIN-123",
        brand: "Lenovo",
        model: "Legion 5",
        cpu: { label: "Intel Core i7-13620H" },
        gpu: { label: "NVIDIA RTX 4060", dedicated: true, vramGb: 8 },
        ramGb: 32,
        ramUpgradeable: true,
        storageGb: 1_000,
        storageUpgradeable: true,
        display: { colorGamut: "100% sRGB", refreshRateHz: 144 },
        weightKg: 1.6,
        operatingSystem: "Windows 11 Home",
        warranty: "1 year manufacturer warranty",
        price: { amount: 74_999, currency: "INR" },
        priceFetchedAt: "2026-07-16T11:30:00.000Z",
        priceFreshness: "fresh",
        url: "https://www.amazon.in/dp/ASIN-123",
        affiliateUrl: "https://www.amazon.in/dp/ASIN-123?tag=example-21",
      })
    );

    expect(result).toMatchObject({
      confidenceScore: 100,
      fitScore: 87,
      complianceStatus: "safe",
      riskTags: [],
    });
    expect(result.fitTags).toEqual(
      expect.arrayContaining([
        "animation",
        "budget-value",
        "creative-gpu",
        "graphic-design",
        "heavy-workload",
        "portable",
        "upgrade-friendly",
        "video-editing",
      ])
    );
  });

  it("blocks a marketplace candidate whose URL does not match its source", () => {
    const result = assessCandidate(
      product({
        sourceKey: "amazon",
        url: "https://catalog.example/not-an-amazon-product",
      })
    );

    expect(result.complianceStatus).toBe("blocked");
    expect(result.riskTags).toEqual(
      expect.arrayContaining(["source-url-mismatch", "needs-admin-review"])
    );
  });

  it("marks stale prices for review", () => {
    const result = assessCandidate(
      product({
        price: { amount: 50_000, currency: "INR" },
        priceFetchedAt: "2026-07-14T12:00:00.000Z",
        priceFreshness: "stale",
      })
    );

    expect(result.complianceStatus).toBe("needs_review");
    expect(result.riskTags).toEqual(
      expect.arrayContaining(["stale-price", "needs-admin-review"])
    );
  });
});

describe("price display policy", () => {
  it("displays only fresh prices on safe candidates", () => {
    expect(isPriceDisplayable("fresh", "safe")).toBe(true);
    expect(isPriceDisplayable("stale", "safe")).toBe(false);
    expect(isPriceDisplayable("fresh", "needs_review")).toBe(false);
    expect(isPriceDisplayable("fresh", "blocked")).toBe(false);
  });
});
