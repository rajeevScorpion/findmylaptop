import { z } from "zod";

export const MAX_BLOG_WRITE_REQUEST_BYTES = 768 * 1024;
const MAX_CONTENT_JSON_CHARS = 500_000;
const MAX_JSON_DEPTH = 12;
const MAX_JSON_KEYS = 100;
const MAX_JSON_ARRAY_ITEMS = 300;
const MAX_JSON_STRING_CHARS = 100_000;

const DANGEROUS_JSON_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function addJsonShapeIssue(
  value: unknown,
  ctx: z.RefinementCtx,
  seen: WeakSet<object>,
  depth = 0
): void {
  if (depth > MAX_JSON_DEPTH) {
    ctx.addIssue({
      code: "custom",
      message: `Content JSON may not exceed ${MAX_JSON_DEPTH} levels`,
    });
    return;
  }

  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return;
  }

  if (typeof value === "string") {
    if (value.length > MAX_JSON_STRING_CHARS) {
      ctx.addIssue({
        code: "custom",
        message: `Content strings may not exceed ${MAX_JSON_STRING_CHARS} characters`,
      });
    }
    return;
  }

  if (typeof value !== "object" || value === undefined) {
    ctx.addIssue({ code: "custom", message: "Content must contain JSON values only" });
    return;
  }

  if (seen.has(value)) {
    ctx.addIssue({ code: "custom", message: "Content must not contain circular values" });
    return;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    if (value.length > MAX_JSON_ARRAY_ITEMS) {
      ctx.addIssue({
        code: "custom",
        message: `Content arrays may not exceed ${MAX_JSON_ARRAY_ITEMS} items`,
      });
      return;
    }
    for (const item of value) addJsonShapeIssue(item, ctx, seen, depth + 1);
    return;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    ctx.addIssue({ code: "custom", message: "Content must use plain JSON objects" });
    return;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_JSON_KEYS) {
    ctx.addIssue({
      code: "custom",
      message: `Content objects may not exceed ${MAX_JSON_KEYS} keys`,
    });
    return;
  }
  for (const [key, child] of entries) {
    if (key.length > 80 || DANGEROUS_JSON_KEYS.has(key)) {
      ctx.addIssue({ code: "custom", message: "Content contains an invalid object key" });
      continue;
    }
    addJsonShapeIssue(child, ctx, seen, depth + 1);
  }
}

const boundedBlockSchema = z
  .object({ type: z.string().trim().min(1).max(80) })
  .passthrough()
  .superRefine((value, ctx) => addJsonShapeIssue(value, ctx, new WeakSet()));

export const boundedBlogContentDocSchema = z
  .object({
    type: z.literal("doc"),
    blocks: z.array(boundedBlockSchema).max(300),
  })
  .strict()
  .superRefine((value, ctx) => {
    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Content must be valid JSON" });
      return;
    }
    if (serialized.length > MAX_CONTENT_JSON_CHARS) {
      ctx.addIssue({
        code: "custom",
        message: `Content may not exceed ${MAX_CONTENT_JSON_CHARS} characters`,
      });
    }
  });

const optionalHttpUrlSchema = z
  .string()
  .trim()
  .max(2_048)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Must be an HTTP or HTTPS URL");

const aiInputsSchema = z
  .object({
    topic: z.string().max(500),
    brief: z.string().max(8_000),
    sourceText: z.string().max(100_000),
    targetLength: z.enum(["short", "medium", "long"]),
    audience: z.string().max(2_000),
    template: z.string().max(120),
  })
  .strict();

/**
 * The browser may submit editable content and persona IDs, but never identity,
 * generated metadata, or a persona snapshot. Those are resolved server-side.
 */
export const blogPostWriteSchema = z
  .object({
    postId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(3).max(300),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    excerpt: z.string().max(2_000),
    content: boundedBlogContentDocSchema,
    status: z.enum(["draft", "ai_generated", "review", "published", "archived"]),
    templateType: z.string().max(120),
    audience: z.array(z.string().trim().min(1).max(120)).max(30),
    primaryKeyword: z.string().max(200),
    secondaryKeywords: z.array(z.string().trim().min(1).max(200)).max(30),
    metaTitle: z.string().max(70),
    metaDescription: z.string().max(200),
    canonicalUrl: optionalHttpUrlSchema,
    ogImageUrl: optionalHttpUrlSchema,
    categoryId: z.string().uuid().nullable(),
    aiInputs: aiInputsSchema,
    authorPersonaId: z.string().uuid().nullable(),
    personaSelectionReason: z.string().max(500),
    personaGenerated: z.boolean(),
    refreshPersonaSnapshot: z.boolean(),
  })
  .strict();

export type BlogPostWriteInput = z.infer<typeof blogPostWriteSchema>;
