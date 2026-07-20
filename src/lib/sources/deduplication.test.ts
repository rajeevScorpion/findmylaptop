import { describe, expect, it } from "vitest";

import {
  buildCandidateDedupeKey,
  canonicalProductText,
  compareProducts,
  findDuplicateMatches,
  jaccardSimilarity,
  productIdentityTokens,
} from "./deduplication";

describe("product identity normalization", () => {
  it("canonicalizes case, accents, and punctuation", () => {
    expect(canonicalProductText("  Café — ASUS VivoBook!  ")).toBe(
      "cafe asus vivobook"
    );
  });

  it("removes generic listing noise from identity tokens", () => {
    const tokens = productIdentityTokens({
      sourceKey: "amazon",
      title: "ASUS VivoBook 15 X1502ZA Laptop with Windows 11 Home",
      brand: "ASUS",
      model: "X1502ZA",
    });

    expect(tokens).toEqual(
      new Set(["asus", "x1502za", "vivobook", "15", "11"])
    );
  });

  it("calculates Jaccard similarity from unique tokens", () => {
    expect(jaccardSimilarity(new Set(["a", "b"]), new Set(["b", "c"]))).toBe(
      1 / 3
    );
    expect(jaccardSimilarity(new Set(), new Set(["a"]))).toBe(0);
  });
});

describe("candidate dedupe keys", () => {
  it("prefers a normalized source product ID", () => {
    expect(
      buildCandidateDedupeKey({
        sourceKey: "amazon",
        sourceProductId: " B0-ABC 123 ",
        title: "Ignored title",
      })
    ).toBe("id:b0 abc 123");
  });

  it("falls back to brand and model, then stable title tokens", () => {
    expect(
      buildCandidateDedupeKey({
        sourceKey: "manual",
        title: "Lenovo ThinkPad T14 Laptop",
        brand: "Lenovo",
        model: "ThinkPad T14",
      })
    ).toBe("model:lenovo:thinkpad t14");
    expect(
      buildCandidateDedupeKey({
        sourceKey: "manual",
        title: "ASUS VivoBook 15 Laptop",
      })
    ).toBe("title:15-asus-vivobook");
  });
});

describe("duplicate comparison", () => {
  it("prioritizes a matching ID within the same source", () => {
    expect(
      compareProducts(
        {
          sourceKey: "amazon",
          sourceProductId: "ASIN-123",
          title: "First title",
        },
        {
          id: "existing-id",
          sourceKey: "amazon",
          sourceProductId: "asin 123",
          title: "Different title",
        }
      )
    ).toEqual({ id: "existing-id", score: 1, reason: "same_source_id" });
  });

  it("matches the same brand and model across sources", () => {
    expect(
      compareProducts(
        {
          sourceKey: "amazon",
          title: "Lenovo ThinkPad T14 on Amazon",
          brand: "Lenovo",
          model: "ThinkPad T14",
        },
        {
          id: "flipkart-id",
          sourceKey: "flipkart",
          title: "ThinkPad T14 business notebook",
          brand: "LENOVO",
          model: "ThinkPad-T14",
        }
      )
    ).toEqual({
      id: "flipkart-id",
      score: 0.98,
      reason: "same_brand_model",
    });
  });

  it("uses bounded token similarity when stronger identifiers are absent", () => {
    expect(
      compareProducts(
        {
          sourceKey: "amazon",
          title: "Lenovo IdeaPad Slim 5 14IRL8 Intel Core i5",
          brand: "Lenovo",
        },
        {
          id: "similar-id",
          sourceKey: "flipkart",
          title: "Lenovo IdeaPad Slim 5 14IRL8 Intel Core i5",
          brand: "Lenovo",
        }
      )
    ).toEqual({
      id: "similar-id",
      score: 0.95,
      reason: "similar_identity",
    });
    expect(
      compareProducts(
        { sourceKey: "amazon", title: "ASUS Zenbook OLED" },
        { sourceKey: "flipkart", title: "Acer Nitro RTX Gaming" }
      )
    ).toBeNull();
  });

  it("returns matches from strongest to weakest", () => {
    const matches = findDuplicateMatches(
      {
        sourceKey: "amazon",
        sourceProductId: "ASIN-123",
        title: "Lenovo ThinkPad T14",
        brand: "Lenovo",
        model: "T14",
      },
      [
        {
          id: "model-match",
          sourceKey: "flipkart",
          sourceProductId: "OTHER-ID",
          title: "Lenovo T14",
          brand: "Lenovo",
          model: "T14",
        },
        {
          id: "source-match",
          sourceKey: "amazon",
          sourceProductId: "ASIN 123",
          title: "Another title",
        },
      ]
    );

    expect(matches.map(({ id, reason }) => ({ id, reason }))).toEqual([
      { id: "source-match", reason: "same_source_id" },
      { id: "model-match", reason: "same_brand_model" },
    ]);
  });
});
