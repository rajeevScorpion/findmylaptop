export type ChipDomain = "design" | "technology" | "management";

export interface ChipPreferenceSignals {
  budgetMin: number | null;
  budgetMax: number | null;
  roleTags: string[];
  courseTags: string[];
  softwareTags: string[];
  brandPreferences: string[];
  priorityTags: string[];
  intentTags: string[];
  confidence: number;
}
export interface ChipSessionProfileRecord {
  id: string;
  anonymous_session_hash: string;
  domain: ChipDomain;
  budget_min: number | null;
  budget_max: number | null;
  role_tags: string[];
  course_tags: string[];
  software_tags: string[];
  brand_preferences: string[];
  priority_tags: string[];
  intent_tags: string[];
  confidence: number;
  signals_count: number;
  last_seen_at: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface RecordChipLearningTurnInput {
  sessionId: string;
  domain: ChipDomain;
  turnNumber: number;
  profileSignals: ChipPreferenceSignals;
  eventSignals: ChipPreferenceSignals;
  recommendedSlugs: readonly string[];
  eventRetentionDays: number;
  profileRetentionDays: number;
  previousProfile?: ChipSessionProfileRecord | null;
}
