export type BlogFactCheckStatus = "pass" | "warning" | "fail";

export interface BlogFactCheckItem {
  key: string;
  label: string;
  status: BlogFactCheckStatus;
  detail: string;
}

export interface BlogDraftQualityResult {
  score: number;
  passed: boolean;
  checks: BlogFactCheckItem[];
}

export interface BlogAgentDraftRecord {
  id: string;
  idempotency_key: string;
  generation_token: string;
  upstream_execution_token: string | null;
  agent_job_id: string | null;
  research_packet_id: string;
  blog_post_id: string | null;
  persona_id: string | null;
  persona_version: number | null;
  status:
    | "generating"
    | "generated"
    | "needs_review"
    | "quality_blocked"
    | "failed"
    | "cancelled";
  quality_score: number | null;
  quality_threshold: number;
  fact_check_json: BlogFactCheckItem[];
  source_refs_json: Array<{ url: string; title?: string }>;
  internal_link_suggestions_json: Array<{ href: string; reason: string }>;
  generation_model: string | null;
  prompt_version: string | null;
  error_code: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
