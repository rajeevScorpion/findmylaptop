import { describe, expect, it } from "vitest";

import {
  getPriceFreshness,
  getPriceFreshUntil,
  normalizeProduct,
} from "./normalization";
import type { SourceProduct } from "./types";

const NOW = new Date("2026-07-16T12:00:00.000Z");

function sourceProduct(overrides: Partial<SourceProduct> = {}): SourceProduct {
  return {
    sourceKey: "manual",
    title: "Evidence-only laptop listing",
    url: "https://catalog.example/laptops/evidence-only",
    fetchedAt: "2026-07-16T11:55:00.000Z",
    rawPayload: {},
    ...overrides,
  };
}

describe("price freshness", () => {
  const price = { amount: 74_999, currency: "INR" };

  it("uses source-specific price TTLs", () => {
    expect(
      getPriceFreshness("amazon", price, "2026-07-16T11:00:00.000Z", NOW)
    ).toBe("fresh");
    expect(
      getPriceFreshness("amazon", price, "2026-07-16T10:59:59.000Z", NOW)
    ).toBe("stale");
    expect(
      getPriceFreshness("flipkart", price, "2026-07-15T12:00:00.000Z", NOW)
    ).toBe("fresh");
  });

  it("distinguishes absent and unverifiable price timestamps", () => {
    expect(getPriceFreshness("manual", undefined, undefined, NOW)).toBe(
      "not_provided"
    );
    expect(getPriceFreshness("manual", price, undefined, NOW)).toBe("unknown");
    expect(getPriceFreshness("manual", price, "not-a-date", NOW)).toBe("unknown");
    expect(
      getPriceFreshness("manual", price, "2026-07-16T12:06:00.000Z", NOW)
    ).toBe("unknown");
  });

  it("calculates the source-specific fresh-until timestamp", () => {
    expect(getPriceFreshUntil("amazon", "2026-07-16T11:00:00.000Z")).toBe(
      "2026-07-16T12:00:00.000Z"
    );
    expect(getPriceFreshUntil("flipkart", "2026-07-16T11:00:00.000Z")).toBe(
      "2026-07-17T11:00:00.000Z"
    );
    expect(getPriceFreshUntil("manual", "not-a-date")).toBeNull();
  });
});

describe("product normalization", () => {
  it("normalizes explicit source evidence and assesses the candidate", () => {
    const normalized = normalizeProduct(
      sourceProduct({
        sourceKey: "amazon",
        sourceProductId: " ASIN-123 ",
        title:
          "Lenovo Legion 5 with 16GB DDR5 RAM, 1TB NVMe SSD and a 15.6 inch 144Hz 100% sRGB display",
        url: "https://www.amazon.in/dp/ASIN-123",
        affiliateUrl: "https://www.amazon.in/dp/ASIN-123?tag=example-21",
        brand: " Lenovo ",
        model: " Legion 5 ",
        cpu: { name: "Intel Core i7-13620H", brand: "Intel", gen: "13th" },
        gpu: {
          name: "NVIDIA GeForce RTX 4060",
          dedicated: "yes",
          vram: "8 GB",
        },
        ramGb: "16 GB",
        ramUpgradeable: "upgradeable",
        storageGb: "1 TB NVMe SSD",
        storageUpgradeable: "yes",
        display: {
          description: "15.6 inch 144Hz 100% sRGB IPS display",
          panel: "IPS",
        },
        weightKg: "1.65 kg",
        batteryWh: "80 Wh",
        operatingSystem: "Windows 11 Home",
        warranty: "1 year manufacturer warranty",
        seller: "Example Retail",
        price: { amount: "74,999", currency: "inr" },
        priceFetchedAt: "2026-07-16T11:30:00.000Z",
        availability: "In stock",
        features: ["16GB DDR5 RAM"],
      }),
      NOW
    );

    expect(normalized).toMatchObject({
      sourceKey: "amazon",
      sourceProductId: "ASIN-123",
      brand: "Lenovo",
      model: "Legion 5",
      ramGb: 16,
      ramType: "DDR5",
      ramUpgradeable: true,
      storageGb: 1_000,
      storageType: "SSD",
      storageUpgradeable: true,
      weightKg: 1.65,
      batteryWh: 80,
      price: { amount: 74_999, currency: "INR" },
      priceFreshness: "fresh",
      complianceStatus: "safe",
      confidenceScore: 100,
    });
    expect(normalized.cpu).toMatchObject({
      label: "Intel Core i7-13620H",
      manufacturer: "Intel",
      generation: "13th",
    });
    expect(normalized.gpu).toMatchObject({
      label: "NVIDIA GeForce RTX 4060",
      dedicated: true,
      vramGb: 8,
    });
    expect(normalized.display).toMatchObject({
      sizeInches: 15.6,
      refreshRateHz: 144,
      colorGamut: "100% sRGB",
      panelType: "IPS",
    });
    expect(normalized.fitTags).toEqual(
      expect.arrayContaining([
        "animation",
        "budget-value",
        "creative-gpu",
        "general-student",
        "graphic-design",
        "portable",
        "upgrade-friendly",
        "video-editing",
      ])
    );
    expect(normalized.riskTags).toEqual([]);
  });

  it("leaves unsupported specifications absent", () => {
    const normalized = normalizeProduct(sourceProduct(), NOW);

    expect(normalized.brand).toBeUndefined();
    expect(normalized.cpu).toBeUndefined();
    expect(normalized.gpu).toBeUndefined();
    expect(normalized.ramGb).toBeUndefined();
    expect(normalized.price).toBeUndefined();
    expect(normalized.priceFreshness).toBe("not_provided");
    expect(normalized.riskTags).toEqual(
      expect.arrayContaining([
        "insufficient-source-data",
        "unknown-cpu",
        "unknown-gpu",
        "unknown-ram",
        "unknown-storage",
      ])
    );
  });
});
