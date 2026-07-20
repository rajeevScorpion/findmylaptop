import { z } from "zod";

export const MAX_CATALOG_WRITE_REQUEST_BYTES = 160 * 1024;
export const MAX_REFRESH_PRICES_REQUEST_BYTES = 16 * 1024;

const idSchema = z.string().uuid();

const nullableText = (max: number) => z.string().trim().max(max).nullable();
const boundedItems = (maxItems: number, maxLength: number) =>
  z.array(z.string().trim().min(1).max(maxLength)).max(maxItems);

const httpUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Must be an HTTP or HTTPS URL");

const nullableHttpUrlSchema = z.union([httpUrlSchema, z.null()]);

export const laptopWriteValuesSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .refine((value) => /[a-z0-9]/i.test(value), "Name must contain a letter or number"),
    domain: z.enum(["design", "technology", "management"]),
    brand: nullableText(200),
    model: nullableText(300),
    price_approx: z.number().int().min(0).max(100_000_000).nullable(),
    price_label: nullableText(100),
    amazon_affiliate_url: httpUrlSchema,
    asin: z
      .string()
      .trim()
      .regex(/^[a-z0-9]{10}$/i, "ASIN must contain exactly 10 letters or digits")
      .transform((value) => value.toUpperCase())
      .nullable(),
    image_url: nullableHttpUrlSchema,
    cpu: nullableText(500),
    gpu: nullableText(500),
    gpu_vram_gb: z.number().min(0).max(128).nullable(),
    ram: nullableText(300),
    ram_gb: z.number().int().min(0).max(1_024).nullable(),
    storage: nullableText(300),
    storage_gb: z.number().int().min(0).max(1_000_000).nullable(),
    display: nullableText(1_000),
    weight: nullableText(100),
    os: nullableText(300),
    tier: z.enum(["budget", "value", "balanced", "advanced", "premium"]).nullable(),
    workload_tags: boundedItems(64, 200),
    recommended_for_courses: boundedItems(100, 300),
    not_ideal_for: boundedItems(100, 300),
    why_recommended: nullableText(10_000),
    cautions: nullableText(10_000),
    upgrade_notes: nullableText(10_000),
    four_year_suitability: z.enum(["basic", "good", "strong", "excellent"]).nullable(),
    priority_score: z.number().int().min(0).max(100),
    is_published: z.boolean(),
    raw_input: nullableText(100_000),
  })
  .strict();

export const laptopMutationSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      laptopId: idSchema.nullable(),
      values: laptopWriteValuesSchema,
    })
    .strict(),
  z.object({ action: z.literal("delete"), laptopId: idSchema }).strict(),
  z
    .object({
      action: z.literal("set_published"),
      laptopId: idSchema,
      value: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("set_featured"),
      laptopId: idSchema,
      value: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("set_price"),
      laptopId: idSchema,
      value: z.number().int().min(1).max(100_000_000),
    })
    .strict(),
]);

export type LaptopMutationInput = z.infer<typeof laptopMutationSchema>;

const courseFields = {
  category: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(300),
};

export const courseMutationSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("add"),
      domain: z.enum(["design", "technology", "management"]),
      ...courseFields,
    })
    .strict(),
  z
    .object({
      action: z.literal("update"),
      courseId: idSchema,
      ...courseFields,
      sortOrder: z.number().int().min(0).max(1_000_000),
    })
    .strict(),
  z
    .object({
      action: z.literal("set_active"),
      courseId: idSchema,
      value: z.boolean(),
    })
    .strict(),
  z.object({ action: z.literal("delete"), courseId: idSchema }).strict(),
]);

export type CourseMutationInput = z.infer<typeof courseMutationSchema>;

export const refreshPricesRequestSchema = z
  .object({
    ids: z.array(idSchema).min(1).max(100).optional(),
    republishIfAvailable: z.boolean().optional().default(false),
  })
  .strict();

export type RefreshPricesRequest = z.infer<typeof refreshPricesRequestSchema>;
