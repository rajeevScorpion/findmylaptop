import { zodTextFormat } from "openai/helpers/zod";
import type { ZodType } from "zod";

const SCHEMA_MAP_KEYWORDS = new Set([
  "$defs",
  "definitions",
  "dependentSchemas",
  "patternProperties",
  "properties",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Remove JSON Schema string-format annotations that are not accepted by every
 * Responses Structured Outputs model. The original Zod schema remains attached
 * to the SDK parser, so URL, UUID, date, email, and other format checks still run
 * locally after generation.
 */
function withoutStringFormats(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutStringFormats);
  if (!isRecord(value)) return value;

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "format") continue;

    if (SCHEMA_MAP_KEYWORDS.has(key) && isRecord(child)) {
      result[key] = Object.fromEntries(
        Object.entries(child).map(([name, schema]) => [
          name,
          withoutStringFormats(schema),
        ])
      );
      continue;
    }

    result[key] = withoutStringFormats(child);
  }
  return result;
}

export function openAITextFormat<Schema extends ZodType>(
  schema: Schema,
  name: string
) {
  const format = zodTextFormat(schema, name);
  format.schema = withoutStringFormats(format.schema) as typeof format.schema;
  return format;
}
