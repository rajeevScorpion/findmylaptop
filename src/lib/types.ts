import type { z } from "zod";
import type {
  laptopSchema,
  courseSchema,
  filterStateSchema,
  processedLaptopInputSchema,
} from "./schemas";

export type LaptopTier = "budget" | "value" | "balanced" | "advanced" | "premium";
export type WorkloadLevel = "light" | "balanced" | "heavy";
export type FourYearSuitability = "basic" | "good" | "strong" | "excellent";
export type WorkloadTag =
  | "2d"
  | "uiux"
  | "video"
  | "fashion"
  | "interior"
  | "product"
  | "animation"
  | "game"
  | "3d"
  | "ai"
  | "coding"
  | "rendering";

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
