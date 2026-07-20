import { describe, expect, it } from "vitest";
import { z } from "zod";
import { processedLaptopStructuredOutputSchema } from "@/lib/schemas";
import { generatedResearchResultSchema } from "@/lib/research-calendar/schemas";
import {
  blogDraftStructuredOutputSchema,
  blogFullStructuredOutputSchema,
  blogMetadataStructuredOutputSchema,
  blogOutlineStructuredOutputSchema,
  faqsSchema,
} from "@/lib/blog/schemas";
import { openAITextFormat } from "./structured-output";

function schemaContainsFormat(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(schemaContainsFormat);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, child]) => key === "format" || schemaContainsFormat(child)
  );
}

describe("openAITextFormat", () => {
  it("removes unsupported string formats while preserving local Zod validation", () => {
    const schema = z.object({
      website: z.string().url(),
      identifier: z.string().uuid(),
      timestamp: z.iso.datetime(),
    });
    const format = openAITextFormat(schema, "format_compatibility_test");

    expect(schemaContainsFormat(format.schema)).toBe(false);
    expect(() =>
      format.$parseRaw(
        JSON.stringify({
          website: "not a URL",
          identifier: "11111111-1111-4111-8111-111111111111",
          timestamp: "2026-07-20T09:00:00.000Z",
        })
      )
    ).toThrow();
    expect(
      format.$parseRaw(
        JSON.stringify({
          website: "https://example.com/source",
          identifier: "11111111-1111-4111-8111-111111111111",
          timestamp: "2026-07-20T09:00:00.000Z",
        })
      )
    ).toEqual({
      website: "https://example.com/source",
      identifier: "11111111-1111-4111-8111-111111111111",
      timestamp: "2026-07-20T09:00:00.000Z",
    });
  });

  it("preserves an output property literally named format", () => {
    const format = openAITextFormat(
      z.object({ format: z.string(), sourceUrl: z.string().url() }),
      "format_property_test"
    );
    const root = format.schema as {
      properties?: Record<string, Record<string, unknown>>;
    };

    expect(root.properties?.format).toEqual({ type: "string" });
    expect(root.properties?.sourceUrl?.format).toBeUndefined();
  });

  it.each([
    ["research packets", generatedResearchResultSchema],
    ["laptop extraction", processedLaptopStructuredOutputSchema],
  ])("emits a format-compatible schema for %s", (_name, schema) => {
    const format = openAITextFormat(schema, "real_schema_compatibility_test");
    expect(schemaContainsFormat(format.schema)).toBe(false);
  });

  it.each([
    ["blog outline", blogOutlineStructuredOutputSchema],
    ["blog draft", blogDraftStructuredOutputSchema],
    ["blog full", blogFullStructuredOutputSchema],
    ["blog metadata", blogMetadataStructuredOutputSchema],
    ["blog FAQs", faqsSchema],
    ["blog section", z.object({ text: z.string() })],
  ])("builds a strict transport schema for %s", (_name, schema) => {
    expect(() => openAITextFormat(schema, "blog_schema_test")).not.toThrow();
  });

  it("uses a typed union for generated blog blocks", () => {
    const format = openAITextFormat(
      blogDraftStructuredOutputSchema,
      "blog_block_schema_test"
    );
    const serialized = JSON.stringify(format.schema);

    expect(serialized).toContain('"anyOf"');
    expect(serialized).not.toContain('"items":{}');
  });
});
