import { z } from "zod";
import type { SourceCredentialStatus } from "@/lib/growth-agents/types";
import { isHttpUrl } from "@/lib/http-url";

export const SOURCE_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export const sourceKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(SOURCE_KEY_PATTERN, "Use lowercase letters, numbers, hyphens, or underscores");

const httpUrlSchema = z
  .url()
  .max(2_048)
  .refine(isHttpUrl, "Only HTTP or HTTPS URLs are allowed");

export const sourceProductSchema = z
  .object({
    sourceKey: sourceKeySchema,
    sourceProductId: z.string().trim().min(1).max(256).optional(),
    title: z.string().trim().min(1).max(500),
    url: httpUrlSchema,
    affiliateUrl: httpUrlSchema.optional(),
    brand: z.string().trim().min(1).max(160).optional(),
    model: z.string().trim().min(1).max(200).optional(),
    cpu: z.unknown().optional(),
    gpu: z.unknown().optional(),
    ramGb: z.unknown().optional(),
    ramType: z.unknown().optional(),
    ramUpgradeable: z.unknown().optional(),
    storageGb: z.unknown().optional(),
    storageType: z.unknown().optional(),
    storageUpgradeable: z.unknown().optional(),
    display: z.unknown().optional(),
    weightKg: z.unknown().optional(),
    batteryWh: z.unknown().optional(),
    operatingSystem: z.unknown().optional(),
    warranty: z.unknown().optional(),
    seller: z.unknown().optional(),
    price: z.unknown().optional(),
    priceFetchedAt: z.iso.datetime({ offset: true }).optional(),
    availability: z.string().trim().min(1).max(200).optional(),
    imageUrl: httpUrlSchema.optional(),
    fetchedAt: z.iso.datetime({ offset: true }),
    features: z.array(z.string().trim().min(1).max(2_000)).max(200).optional(),
    rawPayload: z.unknown(),
  })
  .strict();

export type SourceProduct = z.infer<typeof sourceProductSchema>;

export const cpuSpecSchema = z
  .object({
    label: z.string().min(1).optional(),
    manufacturer: z.string().min(1).optional(),
    family: z.string().min(1).optional(),
    generation: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
  })
  .strict();

export const gpuSpecSchema = z
  .object({
    label: z.string().min(1).optional(),
    manufacturer: z.string().min(1).optional(),
    family: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    dedicated: z.boolean().nullable().optional(),
    vramGb: z.number().nonnegative().max(128).optional(),
  })
  .strict();

export const displaySpecSchema = z
  .object({
    label: z.string().min(1).optional(),
    sizeInches: z.number().positive().max(30).optional(),
    resolution: z.string().min(1).optional(),
    refreshRateHz: z.number().positive().max(1000).optional(),
    colorGamut: z.string().min(1).optional(),
    panelType: z.string().min(1).optional(),
  })
  .strict();

export const normalizedLaptopSchema = z
  .object({
    sourceKey: sourceKeySchema,
    sourceProductId: z.string().min(1).max(256).optional(),
    title: z.string().min(1).max(500),
    brand: z.string().min(1).max(160).optional(),
    model: z.string().min(1).max(200).optional(),
    cpu: cpuSpecSchema.optional(),
    gpu: gpuSpecSchema.optional(),
    ramGb: z.number().int().positive().max(1024).optional(),
    ramType: z.string().min(1).max(80).optional(),
    ramUpgradeable: z.boolean().nullable().optional(),
    storageGb: z.number().int().positive().max(100_000).optional(),
    storageType: z.enum(["SSD", "HDD", "Hybrid", "Unknown"]).optional(),
    storageUpgradeable: z.boolean().nullable().optional(),
    display: displaySpecSchema.optional(),
    weightKg: z.number().positive().max(20).optional(),
    batteryWh: z.number().positive().max(500).optional(),
    operatingSystem: z.string().min(1).max(160).optional(),
    warranty: z.string().min(1).max(300).optional(),
    seller: z.string().min(1).max(300).optional(),
    price: z
      .object({
        amount: z.number().nonnegative(),
        currency: z.string().length(3),
      })
      .strict()
      .optional(),
    priceFetchedAt: z.iso.datetime({ offset: true }).optional(),
    priceFreshness: z.enum(["fresh", "stale", "unknown", "not_provided"]),
    availability: z.string().min(1).max(200).optional(),
    url: httpUrlSchema,
    affiliateUrl: httpUrlSchema.optional(),
    imageUrl: httpUrlSchema.optional(),
    fetchedAt: z.iso.datetime({ offset: true }),
    fitTags: z.array(z.string()),
    riskTags: z.array(z.string()),
    confidenceScore: z.number().int().min(0).max(100),
    fitScore: z.number().int().min(0).max(100),
    complianceStatus: z.enum(["safe", "needs_review", "blocked"]),
  })
  .strict();

export type NormalizedLaptop = z.infer<typeof normalizedLaptopSchema>;
export type ComplianceStatus = NormalizedLaptop["complianceStatus"];
export type PriceFreshness = NormalizedLaptop["priceFreshness"];

export const candidateReviewStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "needs_edit",
  "stale",
]);
export type CandidateReviewStatus = z.infer<typeof candidateReviewStatusSchema>;

export const candidateActionSchema = z.object({
  action: z.enum(["approve", "reject", "needs_edit", "stale"]),
  adminNotes: z.string().trim().max(4_000).nullable().optional(),
});
export type CandidateAction = z.infer<typeof candidateActionSchema>;

export interface ProductCandidateRow {
  id: string;
  source_key: string;
  source_product_id: string | null;
  dedupe_key: string;
  raw_payload_json: unknown;
  normalized_json: NormalizedLaptop;
  title: string;
  brand: string | null;
  model: string | null;
  price_amount: number | null;
  price_currency: string | null;
  price_fetched_at: string | null;
  product_url: string;
  affiliate_url: string | null;
  image_url: string | null;
  source_fetched_at: string;
  fresh_until: string | null;
  confidence_score: number;
  fit_score: number;
  fit_tags: string[];
  risk_tags: string[];
  compliance_status: ComplianceStatus;
  review_status: CandidateReviewStatus;
  admin_notes: string | null;
  error_message: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  promoted_laptop_id: string | null;
  target_domain: "design" | "technology" | "management";
  suggested_course_names: string[];
  rulebook_version: number | null;
  portfolio_role: "best_overall" | "best_value" | "specialist" | null;
  gap_reason: string | null;
  curation_score: number | null;
  discovered_by_agent: boolean;
  created_at: string;
  updated_at: string;
}

export type SourceAdapterMode = "api" | "manual" | "feed";
export type SourceHealthStatus =
  | "ready"
  | "disabled"
  | "unconfigured"
  | "degraded"
  | "unavailable";

export interface SourceCapabilities {
  productId: boolean;
  productUrl: boolean;
  manualPayload: boolean;
  livePrice: boolean;
}

export interface SourceHealth {
  sourceKey: string;
  displayName: string;
  mode: SourceAdapterMode;
  enabled: boolean;
  configured: boolean;
  status: SourceHealthStatus;
  message: string;
  checkedAt: string;
  capabilities: SourceCapabilities;
  remoteChecked: boolean;
  credentialStatus: SourceCredentialStatus;
}

export interface SourceFetchRequest {
  productId?: string;
  url?: string;
  payload?: unknown;
}

export interface SourceHealthOptions {
  probe?: boolean;
}

export interface SourceAdapter {
  readonly key: string;
  readonly displayName: string;
  readonly mode: SourceAdapterMode;
  readonly capabilities: SourceCapabilities;
  getHealth(options?: SourceHealthOptions): Promise<SourceHealth>;
  fetchProduct(request: SourceFetchRequest): Promise<SourceProduct>;
}

export const ingestCandidateSchema = z.object({
  sourceKey: sourceKeySchema.default("manual"),
  targetDomain: z.enum(["design", "technology", "management"]).default("design"),
  productId: z.string().trim().min(1).max(256).optional(),
  url: httpUrlSchema.optional(),
  payload: z.unknown().optional(),
});
export type IngestCandidateInput = z.input<typeof ingestCandidateSchema>;

export const candidateListQuerySchema = z.object({
  status: candidateReviewStatusSchema.optional(),
  source: sourceKeySchema.optional(),
  compliance: z.enum(["safe", "needs_review", "blocked"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type CandidateListQuery = z.infer<typeof candidateListQuerySchema>;
