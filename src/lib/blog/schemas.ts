import { z } from "zod";

// ---- Block schemas ---------------------------------------------------------

export const heroBlockSchema = z.object({
  type: z.literal("hero"),
  data: z.object({ title: z.string(), excerpt: z.string().optional() }),
});

export const headingBlockSchema = z.object({
  type: z.literal("heading"),
  level: z.union([z.literal(2), z.literal(3)]),
  text: z.string().min(1),
  id: z.string().min(1),
});

export const paragraphBlockSchema = z.object({
  type: z.literal("paragraph"),
  text: z.string(),
});

export const bulletsBlockSchema = z.object({
  type: z.literal("bullets"),
  items: z.array(z.string()),
});

export const numberedBlockSchema = z.object({
  type: z.literal("numbered"),
  items: z.array(z.string()),
});

export const cardBlockSchema = z.object({
  type: z.literal("card"),
  variant: z.string().optional(),
  icon: z.string().optional(),
  title: z.string().optional(),
  content: z.string(),
});

export const calloutBlockSchema = z.object({
  type: z.literal("callout"),
  variant: z.enum(["info", "warning", "tip"]),
  title: z.string().optional(),
  content: z.string(),
});

export const faqBlockSchema = z.object({
  type: z.literal("faq"),
  items: z.array(
    z.object({ question: z.string().min(1), answer: z.string().min(1) })
  ),
});

export const ctaBlockSchema = z.object({
  type: z.literal("cta"),
  variant: z.string().optional(),
  title: z.string(),
  body: z.string().optional(),
  href: z.string(),
  label: z.string().optional(),
});

export const productGridPlaceholderBlockSchema = z.object({
  type: z.literal("product_grid_placeholder"),
  data: z.object({
    filterIntent: z.string().optional(),
    limit: z.number().int().optional(),
  }),
});

export const blockSchema = z.discriminatedUnion("type", [
  heroBlockSchema,
  headingBlockSchema,
  paragraphBlockSchema,
  bulletsBlockSchema,
  numberedBlockSchema,
  cardBlockSchema,
  calloutBlockSchema,
  faqBlockSchema,
  ctaBlockSchema,
  productGridPlaceholderBlockSchema,
]);

export const blogContentDocSchema = z.object({
  type: z.literal("doc"),
  // Use a loose passthrough for unknown/future blocks so validation never
  // discards admin content. The renderer handles unknown blocks gracefully.
  blocks: z.array(z.unknown()),
});

// ---- AI generation input/output -------------------------------------------

export const blogAudienceSchema = z.array(z.string()).default([]);

export const blogGenerateInputSchema = z.object({
  generationType: z.enum([
    "outline",
    "draft",
    "metadata",
    "faqs",
    "section",
  ]),
  topic: z.string().min(3, "Topic is required"),
  brief: z.string().optional().default(""),
  audience: blogAudienceSchema,
  primaryKeyword: z.string().optional().default(""),
  secondaryKeywords: z.array(z.string()).optional().default([]),
  templateType: z.string().optional().default("buying_guide"),
  includeProducts: z.boolean().optional().default(false),
  // For "section" rewrites: the text to improve.
  sectionText: z.string().optional(),
  // Optional grounded product facts passed from the DB (never invented by AI).
  productFacts: z.array(z.record(z.string(), z.unknown())).optional(),
});
export type BlogGenerateInput = z.infer<typeof blogGenerateInputSchema>;

export const outlineSchema = z.object({
  title: z.string(),
  slug: z.string(),
  searchIntent: z.string().optional(),
  audienceNotes: z.string().optional(),
  outline: z.array(
    z.object({
      heading: z.string(),
      purpose: z.string().optional(),
      keyPoints: z.array(z.string()).optional(),
    })
  ),
  suggestedInternalLinks: z
    .array(z.object({ anchor: z.string(), href: z.string() }))
    .optional(),
});

export const draftSchema = z.object({
  title: z.string(),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  content: blogContentDocSchema,
});

export const metadataSchema = z.object({
  meta_title: z.string(),
  meta_description: z.string(),
  og_title: z.string().optional(),
  og_description: z.string().optional(),
});

export const faqsSchema = z.object({
  items: z.array(
    z.object({ question: z.string(), answer: z.string() })
  ),
});

// Validate a generated draft document's individual blocks, returning the list
// of blocks that failed validation (renderer can still show valid ones).
export function validateGeneratedBlocks(blocks: unknown[]): {
  valid: number;
  invalidIndexes: number[];
} {
  const invalidIndexes: number[] = [];
  blocks.forEach((b, i) => {
    if (!blockSchema.safeParse(b).success) invalidIndexes.push(i);
  });
  return { valid: blocks.length - invalidIndexes.length, invalidIndexes };
}

// ---- Admin post form -------------------------------------------------------

export const blogStatusSchema = z.enum([
  "draft",
  "ai_generated",
  "review",
  "published",
  "archived",
]);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const blogPostFormSchema = z.object({
  title: z.string().min(3, "Title is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(SLUG_RE, "Slug must be lowercase words separated by hyphens"),
  excerpt: z.string().optional().or(z.literal("")),
  status: blogStatusSchema.default("draft"),
  template_type: z.string().optional().or(z.literal("")),
  audience: z.array(z.string()).default([]),
  primary_keyword: z.string().optional().or(z.literal("")),
  secondary_keywords: z.array(z.string()).default([]),
  meta_title: z.string().max(70, "Keep under ~60 characters").optional().or(z.literal("")),
  meta_description: z
    .string()
    .max(200, "Keep under ~160 characters")
    .optional()
    .or(z.literal("")),
  canonical_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  og_title: z.string().optional().or(z.literal("")),
  og_description: z.string().optional().or(z.literal("")),
  og_image_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  category_id: z.string().uuid().optional().or(z.literal("")),
  // content_json is managed by the block editor, validated separately.
});
export type BlogPostFormData = z.infer<typeof blogPostFormSchema>;
