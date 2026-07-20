import { describe, expect, it } from "vitest";

import { ingestCandidateSchema, sourceProductSchema } from "./types";

function sourceProduct(overrides: Record<string, unknown> = {}) {
  return {
    sourceKey: "manual",
    title: "Example Laptop",
    url: "https://example.com/laptop",
    fetchedAt: "2026-07-20T00:00:00.000Z",
    rawPayload: {},
    ...overrides,
  };
}

describe("source URL boundaries", () => {
  it("accepts HTTP destinations and rejects executable URL schemes", () => {
    expect(sourceProductSchema.safeParse(sourceProduct()).success).toBe(true);
    expect(
      sourceProductSchema.safeParse(
        sourceProduct({ url: "javascript:alert(document.domain)" })
      ).success
    ).toBe(false);
    expect(
      ingestCandidateSchema.safeParse({
        sourceKey: "manual",
        url: "data:text/html,unsafe",
      }).success
    ).toBe(false);
  });

  it("bounds provider feature arrays before persistence", () => {
    expect(
      sourceProductSchema.safeParse(
        sourceProduct({ features: Array.from({ length: 201 }, () => "feature") })
      ).success
    ).toBe(false);
  });
});
