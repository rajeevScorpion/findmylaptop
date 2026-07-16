export type PersonaStatus =
  | "draft"
  | "active"
  | "disabled"
  | "archived"
  | "soft_deleted";

export type PersonaAuthorType = "human" | "ai_persona" | "brand";

export interface PersonaToneSettings {
  formality: "friendly" | "professional" | "academic" | "technical";
  depth: "basic" | "intermediate" | "advanced";
  reassuranceLevel: "low" | "medium" | "high";
  technicalDensity: "low" | "medium" | "high";
}

export interface PersonaAffiliatePolicy {
  allowAffiliateLinks: boolean;
  maxProductCards: number;
  requiredDisclosureText: string;
}

export interface PersonaPermissions {
  canWriteBlogs: boolean;
  canWriteComparisons: boolean;
  canInsertProductCards: boolean;
  canBeAutoScheduled: boolean;
  alwaysRequiresManualReview: boolean;
}

export interface BlogAuthorPersona {
  id: string;
  slug: string;
  displayName: string;
  publicRole: string;
  shortBio: string;
  longInternalDescription: string | null;
  authorType: PersonaAuthorType;
  status: PersonaStatus;
  version: number;
  avatarUrl: string | null;
  expertiseTags: string[];
  targetAudienceTags: string[];
  topicCategoryTags: string[];
  softwareWorkflowTags: string[];
  toneSettings: PersonaToneSettings;
  buyingPhilosophy: string;
  writingDos: string[];
  writingDonts: string[];
  personaSystemPrompt: string;
  affiliatePolicy: PersonaAffiliatePolicy;
  permissions: PersonaPermissions;
  disclosureText: string;
  priorityWeight: number;
  isDefaultFallback: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Stored on each post so published attribution remains stable when a persona is
// edited or archived. Internal prompts and private descriptions are excluded.
export interface PersonaPublicSnapshot {
  id: string;
  slug: string;
  displayName: string;
  publicRole: string;
  shortBio: string;
  authorType: PersonaAuthorType;
  version: number;
  avatarUrl: string | null;
  expertiseTags: string[];
  disclosureText: string;
}

export interface PersonaOption extends PersonaPublicSnapshot {
  status: PersonaStatus;
  permissions: PersonaPermissions;
}

export interface PersonaSelection {
  persona: BlogAuthorPersona;
  reason: string;
  score: number;
}

export interface PersonaPreviewResult {
  text: string;
  usedAi: boolean;
  model: string | null;
}

export interface PersonaUsage {
  totalPosts: number;
  draftCount: number;
  publishedCount: number;
  lastUsedAt: string | null;
}
