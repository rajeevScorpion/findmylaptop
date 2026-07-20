import { describe, expect, it } from "vitest";
import { personaUpdateSchema } from "@/lib/personas/schemas";
import { generatedFindingSchema } from "@/lib/research-calendar/schemas";
import { sourceProductSchema } from "@/lib/sources/types";
import { isHttpUrl } from "./http-url";

describe("HTTP URL validation", () => {
  it("accepts only HTTP(S) URLs without throwing for malformed input", () => {
    expect(isHttpUrl("https://example.com/source")).toBe(true);
    expect(isHttpUrl("http://example.com/source")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("not a URL")).toBe(false);
  });

  it("keeps schema safeParse calls non-throwing for malformed URLs", () => {
    const finding = {
      title: "Example finding",
      summary: "A sufficiently detailed research summary.",
      evidence: "Supporting evidence from the source.",
      sourceUrl: "not a URL",
      sourceTitle: "Example source",
      publishedAt: null,
      confidenceScore: 80,
      timeSensitive: false,
    };
    const sourceProduct = {
      sourceKey: "manual",
      title: "Example laptop",
      url: "not a URL",
      fetchedAt: "2026-07-20T00:00:00.000Z",
      rawPayload: {},
    };

    expect(() => generatedFindingSchema.safeParse(finding)).not.toThrow();
    expect(generatedFindingSchema.safeParse(finding).success).toBe(false);
    expect(() => personaUpdateSchema.safeParse({ avatarUrl: "not a URL" })).not.toThrow();
    expect(personaUpdateSchema.safeParse({ avatarUrl: "not a URL" }).success).toBe(false);
    expect(() => sourceProductSchema.safeParse(sourceProduct)).not.toThrow();
    expect(sourceProductSchema.safeParse(sourceProduct).success).toBe(false);
  });
});
