import { z } from "zod";
import type { DomainId } from "@/lib/domains";

export const portfolioRoleSchema = z.enum([
  "best_overall",
  "best_value",
  "specialist",
]);

const hardwarePolicyShape = {
  minimumRamGb: z.number().int().min(4).max(256).nullable(),
  minimumStorageGb: z.number().int().min(128).max(8192).nullable(),
  minimumGpuVramGb: z.number().min(0).max(64).nullable(),
  requiresDedicatedGpu: z.boolean().nullable(),
  maximumWeightKg: z.number().positive().max(10).nullable(),
  requiredCpuTerms: z.array(z.string().trim().min(1).max(80)).max(20),
  requiredGpuTerms: z.array(z.string().trim().min(1).max(80)).max(20),
  avoidTerms: z.array(z.string().trim().min(1).max(120)).max(30),
};

export const compiledHardwarePolicySchema = z.object(hardwarePolicyShape).strict();

export const compiledRulebookSchema = z
  .object({
    summary: z.string().trim().min(20).max(1200),
    targetRecommendationsPerCourse: z.number().int().min(1).max(5),
    generalHardware: compiledHardwarePolicySchema,
    preferredCpuTerms: z.array(z.string().trim().min(1).max(80)).max(20),
    preferredGpuTerms: z.array(z.string().trim().min(1).max(80)).max(20),
    preferredDisplayTerms: z.array(z.string().trim().min(1).max(100)).max(20),
    coursePolicies: z
      .array(
        z
          .object({
            courseName: z.string().trim().min(1).max(300),
            rationale: z.string().trim().min(10).max(1000),
            hardware: compiledHardwarePolicySchema,
          })
          .strict()
      )
      .max(100),
    searchStrategies: z
      .array(
        z
          .object({
            keywords: z.string().trim().min(3).max(200),
            portfolioRole: portfolioRoleSchema,
            courseNames: z.array(z.string().trim().min(1).max(300)).min(1).max(20),
            rationale: z.string().trim().min(10).max(1000),
          })
          .strict()
      )
      .min(1)
      .max(12),
  })
  .strict();

export type CompiledRulebook = z.infer<typeof compiledRulebookSchema>;
export type CompiledHardwarePolicy = z.infer<typeof compiledHardwarePolicySchema>;
export type PortfolioRole = z.infer<typeof portfolioRoleSchema>;

export const rulebookUpdateSchema = z
  .object({
    domain: z.enum(["design", "technology", "management"]),
    criteriaText: z.string().trim().min(50).max(20_000),
    enabled: z.boolean(),
    maxDomainRecommendations: z.number().int().min(1).max(30),
    maxCourseRecommendations: z.number().int().min(1).max(10),
    rejectedCooldownDays: z.number().int().min(1).max(365),
  })
  .strict();

export const scheduleUpdateSchema = z
  .object({
    discoveryEnabled: z.boolean(),
    refreshEnabled: z.boolean(),
    paused: z.boolean(),
    runTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timezone: z.string().trim().min(1).max(100),
    refreshIntervalHours: z.number().int().min(1).max(24),
    maxSearchCallsPerRun: z.number().int().min(1).max(50),
    maxItemCallsPerRun: z.number().int().min(1).max(200),
    maxRequestsPerSecond: z.number().min(0.05).max(10),
    maxDailyRequests: z.number().int().min(1).max(100_000),
    refreshBudgetPercent: z.number().int().min(50).max(100),
  })
  .strict();

export interface ProductCurationRulebook {
  id: string;
  domain: DomainId;
  criteria_text: string;
  compiled_json: CompiledRulebook | Record<string, never>;
  version: number;
  enabled: boolean;
  max_domain_recommendations: number;
  max_course_recommendations: number;
  rejected_cooldown_days: number;
  compiled_at: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductCurationSchedule {
  singleton_key: true;
  discovery_enabled: boolean;
  refresh_enabled: boolean;
  paused: boolean;
  run_time: string;
  timezone: string;
  refresh_interval_hours: number;
  max_search_calls_per_run: number;
  max_item_calls_per_run: number;
  max_requests_per_second: number;
  max_daily_requests: number;
  refresh_budget_percent: number;
  last_discovery_started_at: string | null;
  last_discovery_completed_at: string | null;
  last_refresh_started_at: string | null;
  last_refresh_completed_at: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CurationProposalType =
  | "add_course"
  | "remove_course"
  | "publication_review";
export type CurationProposalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "superseded";

export interface ProductCurationProposal {
  id: string;
  agent_job_id: string | null;
  rulebook_id: string | null;
  rulebook_version: number;
  domain: DomainId;
  proposal_type: CurationProposalType;
  laptop_id: string;
  course_id: string | null;
  rationale: string;
  evidence_json: Record<string, unknown>;
  confidence_score: number;
  status: CurationProposalStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  laptop?: { name: string; slug: string; is_published: boolean } | null;
  course?: { name: string; category: string } | null;
}

export interface CatalogCourseSnapshot {
  id: string;
  domain: DomainId;
  category: string;
  name: string;
  workload_level: "light" | "balanced" | "heavy";
}

export interface CatalogLaptopSnapshot {
  id: string;
  domain: DomainId;
  name: string;
  brand: string | null;
  model: string | null;
  asin: string | null;
  cpu: string | null;
  gpu: string | null;
  gpu_vram_gb: number | null;
  ram_gb: number | null;
  storage_gb: number | null;
  display: string | null;
  weight: string | null;
  price_approx: number | null;
  tier: string | null;
  recommended_for_courses: string[];
  is_published: boolean;
  priority_score: number;
  last_checked: string | null;
}

export interface CatalogGap {
  courseId: string;
  courseName: string;
  currentCount: number;
  targetCount: number;
  missingCount: number;
}

export interface CatalogPolicyFinding {
  laptopId: string;
  laptopName: string;
  courseId: string | null;
  courseName: string | null;
  decision: "keep" | "add" | "remove" | "review";
  reasons: string[];
  score: number;
}

export interface CatalogAudit {
  domain: DomainId;
  publishedCount: number;
  unpublishedCount: number;
  pendingCandidateCount: number;
  gaps: CatalogGap[];
  findings: CatalogPolicyFinding[];
  knownAsins: string[];
  knownFingerprints: string[];
  duplicateFingerprints: string[];
  searchAllowed: boolean;
  searchReason: string;
}
