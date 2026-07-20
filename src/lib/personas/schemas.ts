import { z } from "zod";
import { isHttpUrl } from "@/lib/http-url";

export const personaStatusSchema = z.enum([
  "draft",
  "active",
  "disabled",
  "archived",
  "soft_deleted",
]);

export const personaAuthorTypeSchema = z.enum(["human", "ai_persona", "brand"]);

const tagArray = z.array(z.string().trim().min(1).max(80)).max(50).default([]);

export const personaToneSettingsSchema = z.object({
  formality: z.enum(["friendly", "professional", "academic", "technical"]),
  depth: z.enum(["basic", "intermediate", "advanced"]),
  reassuranceLevel: z.enum(["low", "medium", "high"]),
  technicalDensity: z.enum(["low", "medium", "high"]),
});

export const personaAffiliatePolicySchema = z.object({
  allowAffiliateLinks: z.boolean(),
  maxProductCards: z.number().int().min(0).max(12),
  requiredDisclosureText: z.string().trim().max(500),
});

export const personaPermissionsSchema = z.object({
  canWriteBlogs: z.boolean(),
  canWriteComparisons: z.boolean(),
  canInsertProductCards: z.boolean(),
  canBeAutoScheduled: z.boolean(),
  alwaysRequiresManualReview: z.boolean(),
});

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens");

const nullableHttpUrlSchema = z
  .string()
  .url()
  .max(2_048)
  .refine(isHttpUrl, "Only HTTP or HTTPS URLs are allowed")
  .nullable();

const personaBaseSchema = z.object({
  slug: slugSchema,
  displayName: z.string().trim().min(2).max(120),
  publicRole: z.string().trim().min(2).max(160),
  shortBio: z.string().trim().min(10).max(600),
  longInternalDescription: z.string().trim().max(4000).nullable().default(null),
  authorType: personaAuthorTypeSchema.default("ai_persona"),
  status: personaStatusSchema.default("draft"),
  avatarUrl: nullableHttpUrlSchema.default(null),
  expertiseTags: tagArray,
  targetAudienceTags: tagArray,
  topicCategoryTags: tagArray,
  softwareWorkflowTags: tagArray,
  toneSettings: personaToneSettingsSchema.default({
    formality: "friendly",
    depth: "intermediate",
    reassuranceLevel: "medium",
    technicalDensity: "medium",
  }),
  buyingPhilosophy: z.string().trim().max(2000).default(""),
  writingDos: tagArray,
  writingDonts: tagArray,
  personaSystemPrompt: z.string().trim().min(20).max(8000),
  affiliatePolicy: personaAffiliatePolicySchema.default({
    allowAffiliateLinks: false,
    maxProductCards: 0,
    requiredDisclosureText: "",
  }),
  permissions: personaPermissionsSchema.default({
    canWriteBlogs: true,
    canWriteComparisons: false,
    canInsertProductCards: false,
    canBeAutoScheduled: false,
    alwaysRequiresManualReview: true,
  }),
  disclosureText: z.string().trim().min(10).max(500),
  priorityWeight: z.number().min(0).max(1000).default(1),
  isDefaultFallback: z.boolean().default(false),
});

export function hasTransparentPersonaDisclosure(
  authorType: z.infer<typeof personaAuthorTypeSchema>,
  disclosureText: string
): boolean {
  if (authorType === "human") return true;
  if (authorType === "brand") {
    return /(brand|editorial|team|organisation|organization)/i.test(disclosureText);
  }
  return /(editorial|\bai\b|artificial|persona|not (?:a )?real|fictional)/i.test(
    disclosureText
  );
}

function addDisclosureIssue(
  value: { authorType?: z.infer<typeof personaAuthorTypeSchema>; disclosureText?: string },
  context: z.RefinementCtx
) {
  if (
    value.authorType &&
    value.disclosureText !== undefined &&
    !hasTransparentPersonaDisclosure(value.authorType, value.disclosureText)
  ) {
    context.addIssue({
      code: "custom",
      path: ["disclosureText"],
      message: "Editorial and brand personas must be clearly disclosed as non-human editorial identities.",
    });
  }
}

export const personaInputSchema = personaBaseSchema.superRefine(addDisclosureIssue);

export const personaUpdateSchema = personaBaseSchema.partial().superRefine(addDisclosureIssue).refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required"
);

export const personaActionSchema = z.object({
  action: z.enum(["disable", "archive", "soft_delete", "restore", "hard_delete"]),
});

export const personaPreviewInputSchema = z.object({
  topic: z.string().trim().min(3).max(500),
});

export const personaSelectionInputSchema = z.object({
  topic: z.string().trim().min(3).max(1000),
  targetAudience: tagArray.optional(),
  topicCategory: z.string().trim().max(120).optional(),
  softwareWorkflows: tagArray.optional(),
});

export type PersonaInput = z.infer<typeof personaInputSchema>;
export type PersonaUpdate = z.infer<typeof personaUpdateSchema>;
export type PersonaSelectionInput = z.infer<typeof personaSelectionInputSchema>;
