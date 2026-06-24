import type { z } from "zod";
import type {
  laptopSchema,
  courseSchema,
  filterStateSchema,
  processedLaptopInputSchema,
} from "./schemas";
import type { ALL_WORKLOAD_TAGS } from "./domains";

export type LaptopTier = "budget" | "value" | "balanced" | "advanced" | "premium";
export type WorkloadLevel = "light" | "balanced" | "heavy";
export type FourYearSuitability = "basic" | "good" | "strong" | "excellent";
// Workload tags are defined per-domain in domains.ts; this is the union of every
// known tag value across all domains (the single source of truth).
export type WorkloadTag = (typeof ALL_WORKLOAD_TAGS)[number]["value"];

export type Laptop = z.infer<typeof laptopSchema>;
export type Course = z.infer<typeof courseSchema>;
export type FilterState = z.infer<typeof filterStateSchema>;
export type ProcessedLaptopInput = z.infer<typeof processedLaptopInputSchema>;

export interface RecommendationResult extends Laptop {
  suitabilityScore: number;
  badges: BadgeType[];
}

export type BadgeType =
  | "Best Value"
  | "Future Ready"
  | "Heavy 3D"
  | "AI Ready"
  | "Portable Choice"
  | "Budget Conscious";

export type SortOption =
  | "recommended"
  | "price-asc"
  | "price-desc"
  | "gpu-strength"
  | "four-year";

// ── Chip Chat Types ──────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  recommendedSlugs?: string[];
  suggestions?: string[];
  timestamp: number;
}

export interface ChatApiRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  sessionId?: string;
  domain?: "design" | "technology" | "management";
}

export interface ChatApiResponse {
  message: string;
  recommendedSlugs: string[];
  suggestions: string[];
  sessionId: string;
  messagesRemaining: number;
}

export interface ChipJsonOutput {
  message: string;
  recommendedSlugs: string[];
  suggestions: string[];
}
