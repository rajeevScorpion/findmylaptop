import { z } from "zod";

export const calendarModeSchema = z.enum([
  "draft_only",
  "approval_required",
  "auto_schedule",
  "auto_publish",
]);

export const researchContentTypeSchema = z.enum([
  "news",
  "software-guide",
  "buying-guide",
  "comparison",
  "deal-roundup",
  "trust-education",
  "weekly-roundup",
  "evergreen",
]);

const cleanStringArray = z
  .array(z.string().trim().min(1).max(160))
  .max(40);

function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const calendarPatchSchema = z
  .object({
    name: z.string().trim().min(3).max(120).optional(),
    enabled: z.boolean().optional(),
    paused: z.boolean().optional(),
    timezone: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .refine(validTimeZone, "Use a valid IANA timezone, such as Asia/Kolkata.")
      .optional(),
    mode: calendarModeSchema.optional(),
    max_posts_per_day: z.number().int().min(0).max(20).optional(),
    max_posts_per_week: z.number().int().min(0).max(100).optional(),
    max_auto_posts_per_day: z.number().int().min(0).max(20).optional(),
    max_auto_posts_per_week: z.number().int().min(0).max(100).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.max_posts_per_day !== undefined &&
      value.max_posts_per_week !== undefined &&
      value.max_posts_per_day > value.max_posts_per_week
    ) {
      context.addIssue({
        code: "custom",
        path: ["max_posts_per_day"],
        message: "Daily post limit cannot exceed the weekly limit.",
      });
    }
    if (
      value.max_auto_posts_per_day !== undefined &&
      value.max_posts_per_day !== undefined &&
      value.max_auto_posts_per_day > value.max_posts_per_day
    ) {
      context.addIssue({
        code: "custom",
        path: ["max_auto_posts_per_day"],
        message: "Automatic daily drafts cannot exceed the daily post limit.",
      });
    }
    if (
      value.max_auto_posts_per_week !== undefined &&
      value.max_posts_per_week !== undefined &&
      value.max_auto_posts_per_week > value.max_posts_per_week
    ) {
      context.addIssue({
        code: "custom",
        path: ["max_auto_posts_per_week"],
        message: "Automatic weekly drafts cannot exceed the weekly post limit.",
      });
    }
  });

export const calendarDayPatchSchema = z
  .object({
    id: z.string().uuid(),
    enabled: z.boolean().optional(),
    run_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/).optional(),
    theme_name: z.string().trim().min(3).max(160).optional(),
    theme_description: z.string().trim().max(1000).nullable().optional(),
    keywords: cleanStringArray.optional(),
    target_audience: cleanStringArray.optional(),
    content_types: z.array(researchContentTypeSchema).min(1).max(8).optional(),
    preferred_persona_slugs: cleanStringArray.optional(),
    source_priority: cleanStringArray.optional(),
    min_posts: z.number().int().min(0).max(20).optional(),
    target_posts: z.number().int().min(0).max(20).optional(),
    max_posts: z.number().int().min(0).max(20).optional(),
    allow_carry_forward: z.boolean().optional(),
    carry_forward_limit_days: z.number().int().min(0).max(30).optional(),
    approval_mode: calendarModeSchema.optional(),
    affiliate_insertion_mode: z
      .enum(["never", "after_approval", "contextual"])
      .optional(),
    product_card_limit: z.number().int().min(0).max(10).optional(),
    min_research_confidence: z.number().min(0).max(100).optional(),
    min_blog_quality: z.number().min(0).max(100).optional(),
    expire_trending_items: z.boolean().optional(),
    packet_expiry_hours: z.number().int().min(1).max(2160).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.min_posts !== undefined &&
      value.target_posts !== undefined &&
      value.min_posts > value.target_posts
    ) {
      context.addIssue({
        code: "custom",
        path: ["min_posts"],
        message: "Minimum posts cannot exceed the target.",
      });
    }
    if (
      value.target_posts !== undefined &&
      value.max_posts !== undefined &&
      value.target_posts > value.max_posts
    ) {
      context.addIssue({
        code: "custom",
        path: ["target_posts"],
        message: "Target posts cannot exceed the maximum.",
      });
    }
  });

export const researchCalendarUpdateSchema = z
  .object({
    calendar: calendarPatchSchema.optional(),
    days: z.array(calendarDayPatchSchema).max(50).optional(),
  })
  .strict()
  .refine((value) => value.calendar || value.days?.length, {
    message: "At least one calendar or day change is required.",
  });

export const researchRunRequestSchema = z
  .object({
    calendarDayId: z.string().uuid().optional(),
    createBlogDrafts: z.boolean().default(true),
  })
  .strict();

export const generatedFindingSchema = z.object({
  title: z.string().min(3).max(240),
  summary: z.string().min(10).max(1500),
  evidence: z.string().min(5).max(1200),
  sourceUrl: z
    .string()
    .url()
    .max(2_048)
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    }),
  sourceTitle: z.string().min(1).max(240),
  publishedAt: z.string().nullable(),
  confidenceScore: z.number().min(0).max(100),
  timeSensitive: z.boolean(),
});

export const generatedPacketSchema = z.object({
  topicTitle: z.string().min(5).max(240),
  topicAngle: z.string().min(10).max(800),
  summary: z.string().min(20).max(2000),
  findings: z.array(generatedFindingSchema).min(1).max(12),
  suggestedPersonas: z
    .array(z.string().trim().min(1).max(120))
    .max(8),
  confidenceScore: z.number().min(0).max(100),
  urgency: z.enum(["low", "medium", "high"]),
  contentType: researchContentTypeSchema,
  monetizationIntent: z.enum([
    "none",
    "soft-contextual",
    "product-cards",
    "comparison-links",
  ]),
});

export const generatedResearchResultSchema = z.object({
  packets: z.array(generatedPacketSchema).max(5),
  noGoodTopicReason: z.string().max(1000).nullable(),
});

export type ResearchCalendarUpdateInput = z.infer<
  typeof researchCalendarUpdateSchema
>;
export type ResearchRunRequestInput = z.infer<typeof researchRunRequestSchema>;
