-- ============================================================================

BEGIN;
-- 034 - Domain rulebooks and autonomous product curation (ADDITIVE ONLY)
-- Requires: 024_create_agent_foundations.sql through 033_add_research_novelty.sql
-- Rollback: 034_add_product_curation_rollback.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_curation_rulebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  criteria_text TEXT NOT NULL,
  compiled_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT false,
  max_domain_recommendations INTEGER NOT NULL DEFAULT 8,
  max_course_recommendations INTEGER NOT NULL DEFAULT 3,
  rejected_cooldown_days INTEGER NOT NULL DEFAULT 30,
  compiled_at TIMESTAMPTZ,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_curation_rulebooks_domain_check CHECK (domain IN ('design', 'technology', 'management')),
  CONSTRAINT product_curation_rulebooks_criteria_length_check CHECK (char_length(criteria_text) BETWEEN 50 AND 20000),
  CONSTRAINT product_curation_rulebooks_compiled_object_check CHECK (jsonb_typeof(compiled_json) = 'object'),
  CONSTRAINT product_curation_rulebooks_version_check CHECK (version BETWEEN 1 AND 1000000),
  CONSTRAINT product_curation_rulebooks_domain_limit_check CHECK (max_domain_recommendations BETWEEN 1 AND 30),
  CONSTRAINT product_curation_rulebooks_course_limit_check CHECK (max_course_recommendations BETWEEN 1 AND 10),
  CONSTRAINT product_curation_rulebooks_cooldown_check CHECK (rejected_cooldown_days BETWEEN 1 AND 365)
);

COMMENT ON TABLE public.product_curation_rulebooks IS
  'Versioned admin-authored domain criteria compiled into a bounded agent planning contract.';
COMMENT ON COLUMN public.product_curation_rulebooks.compiled_json IS
  'Schema-validated interpretation only; deterministic services enforce every mutation and limit.';

INSERT INTO public.product_curation_rulebooks
  (domain, criteria_text, max_domain_recommendations, max_course_recommendations)
VALUES
  ('design', 'Recommend a deliberately small set of dependable laptops for design students. Judge hardware against the heaviest real course workflows, including colour-sensitive visual work, Adobe applications, video, animation, 3D, game art and spatial design where relevant. Prefer adequate memory, sustained CPU and GPU performance, a suitable display, sensible storage, useful upgrade paths and manageable weight. Do not reward gaming branding by itself, do not recommend weak install-minimum configurations, and do not add a laptop unless it fills a genuine course, price or portability gap in the existing catalog.', 8, 3),
  ('technology', 'Recommend a deliberately small set of dependable laptops for technology students. Evaluate coding, local development, containers, virtual machines, data work, cybersecurity, mobile development and engineering workloads as applicable to each course. Prefer sufficient memory, modern multi-core processors, reliable thermals, usable battery life, Linux or tooling compatibility where relevant, and upgradeability when it materially extends useful life. Avoid low-memory configurations and do not add a laptop unless it improves a real course, price or portability gap in the existing catalog.', 8, 3),
  ('management', 'Recommend a deliberately small set of dependable laptops for management students. Prioritize office productivity, research, presentations, analytics, video calls, portability, battery life, keyboard and display comfort, reliability and sensible ownership cost. Require enough memory and storage for several years of use, but avoid charging users for specialist graphics or gaming hardware that their programmes do not need. Do not add a laptop unless it improves a real course, price, portability or longevity gap in the existing catalog.', 8, 3)
ON CONFLICT (domain) DO NOTHING;

DROP TRIGGER IF EXISTS product_curation_rulebooks_updated_at ON public.product_curation_rulebooks;
CREATE TRIGGER product_curation_rulebooks_updated_at BEFORE UPDATE ON public.product_curation_rulebooks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.product_curation_schedule (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT true,
  discovery_enabled BOOLEAN NOT NULL DEFAULT false,
  refresh_enabled BOOLEAN NOT NULL DEFAULT false,
  paused BOOLEAN NOT NULL DEFAULT true,
  run_time TIME NOT NULL DEFAULT '03:00:00',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  refresh_interval_hours INTEGER NOT NULL DEFAULT 22,
  max_search_calls_per_run INTEGER NOT NULL DEFAULT 6,
  max_item_calls_per_run INTEGER NOT NULL DEFAULT 12,
  max_requests_per_second NUMERIC(5,2) NOT NULL DEFAULT 0.50,
  max_daily_requests INTEGER NOT NULL DEFAULT 200,
  refresh_budget_percent INTEGER NOT NULL DEFAULT 80,
  last_discovery_started_at TIMESTAMPTZ,
  last_discovery_completed_at TIMESTAMPTZ,
  last_refresh_started_at TIMESTAMPTZ,
  last_refresh_completed_at TIMESTAMPTZ,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_curation_schedule_singleton_check CHECK (singleton_key),
  CONSTRAINT product_curation_schedule_timezone_check CHECK (char_length(timezone) BETWEEN 1 AND 100),
  CONSTRAINT product_curation_schedule_refresh_interval_check CHECK (refresh_interval_hours BETWEEN 1 AND 24),
  CONSTRAINT product_curation_schedule_search_limit_check CHECK (max_search_calls_per_run BETWEEN 1 AND 50),
  CONSTRAINT product_curation_schedule_item_limit_check CHECK (max_item_calls_per_run BETWEEN 1 AND 200),
  CONSTRAINT product_curation_schedule_rps_check CHECK (max_requests_per_second BETWEEN 0.05 AND 10),
  CONSTRAINT product_curation_schedule_daily_limit_check CHECK (max_daily_requests BETWEEN 1 AND 100000),
  CONSTRAINT product_curation_schedule_budget_check CHECK (refresh_budget_percent BETWEEN 50 AND 100)
);

INSERT INTO public.product_curation_schedule (singleton_key) VALUES (true)
ON CONFLICT (singleton_key) DO NOTHING;
DROP TRIGGER IF EXISTS product_curation_schedule_updated_at ON public.product_curation_schedule;
CREATE TRIGGER product_curation_schedule_updated_at BEFORE UPDATE ON public.product_curation_schedule
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.product_curation_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_job_id UUID REFERENCES public.agent_jobs(id) ON DELETE SET NULL,
  rulebook_id UUID REFERENCES public.product_curation_rulebooks(id) ON DELETE SET NULL,
  rulebook_version INTEGER NOT NULL,
  domain TEXT NOT NULL,
  proposal_type TEXT NOT NULL,
  laptop_id UUID NOT NULL REFERENCES public.laptops(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  rationale TEXT NOT NULL,
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_curation_proposals_domain_check CHECK (domain IN ('design', 'technology', 'management')),
  CONSTRAINT product_curation_proposals_type_check CHECK (proposal_type IN ('add_course', 'remove_course', 'publication_review')),
  CONSTRAINT product_curation_proposals_course_check CHECK ((proposal_type IN ('add_course', 'remove_course') AND course_id IS NOT NULL) OR (proposal_type = 'publication_review' AND course_id IS NULL)),
  CONSTRAINT product_curation_proposals_rationale_length_check CHECK (char_length(rationale) BETWEEN 10 AND 4000),
  CONSTRAINT product_curation_proposals_evidence_object_check CHECK (jsonb_typeof(evidence_json) = 'object'),
  CONSTRAINT product_curation_proposals_confidence_check CHECK (confidence_score BETWEEN 0 AND 100),
  CONSTRAINT product_curation_proposals_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'superseded')),
  CONSTRAINT product_curation_proposals_review_metadata_check CHECK ((status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL) OR (status <> 'pending' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)),
  CONSTRAINT product_curation_proposals_notes_length_check CHECK (admin_notes IS NULL OR char_length(admin_notes) <= 4000)
);

CREATE INDEX IF NOT EXISTS product_curation_proposals_queue_idx
  ON public.product_curation_proposals (status, domain, confidence_score DESC, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS product_curation_proposals_pending_mapping_idx
  ON public.product_curation_proposals (proposal_type, laptop_id, course_id)
  WHERE status = 'pending' AND course_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS product_curation_proposals_pending_publish_idx
  ON public.product_curation_proposals (laptop_id)
  WHERE status = 'pending' AND proposal_type = 'publication_review';
DROP TRIGGER IF EXISTS product_curation_proposals_updated_at ON public.product_curation_proposals;
CREATE TRIGGER product_curation_proposals_updated_at BEFORE UPDATE ON public.product_curation_proposals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.source_api_usage (
  source_key TEXT NOT NULL,
  usage_date DATE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_key, usage_date),
  CONSTRAINT source_api_usage_source_key_check CHECK (source_key ~ '^[a-z][a-z0-9_-]{0,63}$'),
  CONSTRAINT source_api_usage_count_check CHECK (request_count >= 0)
);

CREATE OR REPLACE FUNCTION public.claim_source_api_budget(
  p_source_key TEXT,
  p_daily_limit INTEGER,
  p_min_interval_ms INTEGER,
  p_now TIMESTAMPTZ DEFAULT now()
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_row public.source_api_usage%ROWTYPE;
BEGIN
  IF p_source_key !~ '^[a-z][a-z0-9_-]{0,63}$' OR p_daily_limit < 1 OR p_min_interval_ms < 0 THEN
    RAISE EXCEPTION 'Invalid source API budget claim';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('source-api:' || p_source_key));
  INSERT INTO public.source_api_usage (source_key, usage_date)
    VALUES (p_source_key, (p_now AT TIME ZONE 'UTC')::date)
    ON CONFLICT (source_key, usage_date) DO NOTHING;
  SELECT * INTO v_row FROM public.source_api_usage
    WHERE source_key = p_source_key AND usage_date = (p_now AT TIME ZONE 'UTC')::date FOR UPDATE;
  IF v_row.request_count >= p_daily_limit THEN RETURN false; END IF;
  IF v_row.last_request_at IS NOT NULL
    AND v_row.last_request_at + make_interval(secs => p_min_interval_ms / 1000.0) > p_now
  THEN RETURN false; END IF;
  UPDATE public.source_api_usage SET request_count = request_count + 1, last_request_at = p_now, updated_at = p_now
    WHERE source_key = p_source_key AND usage_date = (p_now AT TIME ZONE 'UTC')::date;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_source_api_budget(TEXT, INTEGER, INTEGER, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_source_api_budget(TEXT, INTEGER, INTEGER, TIMESTAMPTZ) TO service_role;

ALTER TABLE public.product_candidates
  ADD COLUMN IF NOT EXISTS target_domain TEXT NOT NULL DEFAULT 'design',
  ADD COLUMN IF NOT EXISTS suggested_course_names TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rulebook_version INTEGER,
  ADD COLUMN IF NOT EXISTS portfolio_role TEXT,
  ADD COLUMN IF NOT EXISTS gap_reason TEXT,
  ADD COLUMN IF NOT EXISTS curation_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS discovered_by_agent BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_candidates_target_domain_check') THEN
    ALTER TABLE public.product_candidates ADD CONSTRAINT product_candidates_target_domain_check CHECK (target_domain IN ('design', 'technology', 'management'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_candidates_portfolio_role_check') THEN
    ALTER TABLE public.product_candidates ADD CONSTRAINT product_candidates_portfolio_role_check CHECK (portfolio_role IS NULL OR portfolio_role IN ('best_overall', 'best_value', 'specialist'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_candidates_curation_score_check') THEN
    ALTER TABLE public.product_candidates ADD CONSTRAINT product_candidates_curation_score_check CHECK (curation_score IS NULL OR curation_score BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_candidates_gap_reason_length_check') THEN
    ALTER TABLE public.product_candidates ADD CONSTRAINT product_candidates_gap_reason_length_check CHECK (gap_reason IS NULL OR char_length(gap_reason) <= 2000);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS product_candidates_domain_queue_idx
  ON public.product_candidates (target_domain, review_status, curation_score DESC, updated_at DESC);

ALTER TABLE public.product_curation_rulebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_curation_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_curation_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_curation_rulebooks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_curation_schedule FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_curation_proposals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.source_api_usage FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_curation_rulebooks, public.product_curation_schedule, public.product_curation_proposals, public.source_api_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_curation_rulebooks, public.product_curation_schedule, public.product_curation_proposals, public.source_api_usage TO service_role;

COMMIT;
