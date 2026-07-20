export type ResearchCalendarMode =
  | "draft_only"
  | "approval_required"
  | "auto_schedule"
  | "auto_publish";

export type ResearchContentType =
  | "news"
  | "software-guide"
  | "buying-guide"
  | "comparison"
  | "deal-roundup"
  | "trust-education"
  | "weekly-roundup"
  | "evergreen";

export type ResearchPacketStatus =
  | "draft_packet"
  | "ready_for_blog"
  | "needs_admin_review"
  | "used"
  | "rejected"
  | "expired";

export interface ResearchCalendar {
  id: string;
  name: string;
  enabled: boolean;
  paused: boolean;
  timezone: string;
  mode: ResearchCalendarMode;
  max_posts_per_day: number;
  max_posts_per_week: number;
  max_auto_posts_per_day: number;
  max_auto_posts_per_week: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResearchCalendarDay {
  id: string;
  calendar_id: string;
  weekday: number;
  sort_order: number;
  enabled: boolean;
  run_time: string;
  theme_key: string;
  theme_name: string;
  theme_description: string | null;
  keywords: string[];
  target_audience: string[];
  content_types: ResearchContentType[];
  preferred_persona_slugs: string[];
  source_priority: string[];
  min_posts: number;
  target_posts: number;
  max_posts: number;
  allow_carry_forward: boolean;
  carry_forward_limit_days: number;
  approval_mode: ResearchCalendarMode;
  affiliate_insertion_mode: "never" | "after_approval" | "contextual";
  product_card_limit: number;
  min_research_confidence: number;
  min_blog_quality: number;
  expire_trending_items: boolean;
  packet_expiry_hours: number;
  created_at: string;
  updated_at: string;
}

export interface ResearchScheduleRun {
  id: string;
  calendar_id: string;
  calendar_day_id: string | null;
  agent_job_id: string | null;
  execution_token: string | null;
  trigger_type: "scheduled" | "manual" | "retry";
  scheduled_for: string | null;
  idempotency_key: string;
  status:
    | "queued"
    | "running"
    | "succeeded"
    | "partial"
    | "no_good_topic"
    | "failed"
    | "cancelled"
    | "skipped";
  packets_produced: number;
  drafts_produced: number;
  source_failures_json: unknown[];
  result_json: Record<string, unknown>;
  error_code: string | null;
  error_message: string | null;
  notification_sent: boolean;
  started_at: string | null;
  finished_at: string | null;
  packets_persisted_at: string | null;
  created_at: string;
}

export interface ResearchFinding {
  title: string;
  summary: string;
  evidence: string;
  sourceUrl: string;
  sourceTitle: string;
  publishedAt: string | null;
  confidenceScore: number;
  timeSensitive: boolean;
}

export interface GeneratedResearchPacket {
  topicTitle: string;
  topicAngle: string;
  summary: string;
  findings: ResearchFinding[];
  suggestedPersonas: string[];
  confidenceScore: number;
  urgency: "low" | "medium" | "high";
  contentType: ResearchContentType;
  monetizationIntent:
    | "none"
    | "soft-contextual"
    | "product-cards"
    | "comparison-links";
}

export interface ResearchPacketRow {
  id: string;
  schedule_run_id: string;
  calendar_day_id: string | null;
  theme_key: string;
  theme_name: string;
  target_audience: string[];
  suggested_personas: string[];
  topic_title: string;
  topic_angle: string;
  summary: string;
  findings_json: ResearchFinding[];
  product_candidate_ids: string[];
  source_refs_json: Array<{ url: string; title?: string }>;
  confidence_score: number;
  urgency: "low" | "medium" | "high";
  content_type: ResearchContentType;
  monetization_intent: GeneratedResearchPacket["monetizationIntent"];
  status: ResearchPacketStatus;
  expires_at: string | null;
  used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResearchCalendarDashboard {
  calendar: ResearchCalendar | null;
  days: ResearchCalendarDay[];
  recentRuns: ResearchScheduleRun[];
  recentPackets: ResearchPacketRow[];
}
