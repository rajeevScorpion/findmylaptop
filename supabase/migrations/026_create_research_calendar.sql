-- ============================================================================
-- 026 — Configurable Research Agent editorial calendar
-- Apply after:
--   024_create_agent_foundations.sql
--   025_create_product_research.sql
-- Rollback: 026_create_research_calendar_rollback.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.research_editorial_calendars (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL,
  enabled                  BOOLEAN NOT NULL DEFAULT false,
  paused                   BOOLEAN NOT NULL DEFAULT true,
  timezone                 TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  mode                     TEXT NOT NULL DEFAULT 'draft_only'
                             CHECK (mode IN ('draft_only','approval_required','auto_schedule','auto_publish')),
  max_posts_per_day        INTEGER NOT NULL DEFAULT 2 CHECK (max_posts_per_day BETWEEN 0 AND 20),
  max_posts_per_week       INTEGER NOT NULL DEFAULT 7 CHECK (max_posts_per_week BETWEEN 0 AND 100),
  max_auto_posts_per_day   INTEGER NOT NULL DEFAULT 0 CHECK (max_auto_posts_per_day BETWEEN 0 AND 20),
  max_auto_posts_per_week  INTEGER NOT NULL DEFAULT 0 CHECK (max_auto_posts_per_week BETWEEN 0 AND 100),
  created_by               TEXT,
  updated_by               TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT research_calendars_text_length_check CHECK (
    char_length(name) BETWEEN 3 AND 120
    AND char_length(timezone) BETWEEN 3 AND 80
    AND (created_by IS NULL OR char_length(created_by) <= 320)
    AND (updated_by IS NULL OR char_length(updated_by) <= 320)
  ),
  CONSTRAINT research_calendars_limits_check CHECK (
    max_posts_per_day <= max_posts_per_week
    AND max_auto_posts_per_day <= max_posts_per_day
    AND max_auto_posts_per_week <= max_posts_per_week
  )
);

CREATE TABLE IF NOT EXISTS public.research_calendar_days (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id                UUID NOT NULL REFERENCES public.research_editorial_calendars(id) ON DELETE CASCADE,
  weekday                    SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7), -- ISO: Monday=1
  sort_order                 SMALLINT NOT NULL DEFAULT 0,
  enabled                    BOOLEAN NOT NULL DEFAULT true,
  run_time                   TIME NOT NULL DEFAULT '09:00',
  theme_key                  TEXT NOT NULL,
  theme_name                 TEXT NOT NULL,
  theme_description          TEXT,
  keywords                   TEXT[] NOT NULL DEFAULT '{}',
  target_audience            TEXT[] NOT NULL DEFAULT '{}',
  content_types              TEXT[] NOT NULL DEFAULT ARRAY['evergreen']::TEXT[],
  preferred_persona_slugs    TEXT[] NOT NULL DEFAULT '{}',
  source_priority            TEXT[] NOT NULL DEFAULT '{}',
  min_posts                  INTEGER NOT NULL DEFAULT 0 CHECK (min_posts BETWEEN 0 AND 20),
  target_posts               INTEGER NOT NULL DEFAULT 1 CHECK (target_posts BETWEEN 0 AND 20),
  max_posts                  INTEGER NOT NULL DEFAULT 2 CHECK (max_posts BETWEEN 0 AND 20),
  allow_carry_forward        BOOLEAN NOT NULL DEFAULT true,
  carry_forward_limit_days   INTEGER NOT NULL DEFAULT 7 CHECK (carry_forward_limit_days BETWEEN 0 AND 30),
  approval_mode              TEXT NOT NULL DEFAULT 'draft_only'
                               CHECK (approval_mode IN ('draft_only','approval_required','auto_schedule','auto_publish')),
  affiliate_insertion_mode   TEXT NOT NULL DEFAULT 'after_approval'
                               CHECK (affiliate_insertion_mode IN ('never','after_approval','contextual')),
  product_card_limit         INTEGER NOT NULL DEFAULT 0 CHECK (product_card_limit BETWEEN 0 AND 10),
  min_research_confidence    NUMERIC(5,2) NOT NULL DEFAULT 70 CHECK (min_research_confidence BETWEEN 0 AND 100),
  min_blog_quality           NUMERIC(5,2) NOT NULL DEFAULT 75 CHECK (min_blog_quality BETWEEN 0 AND 100),
  expire_trending_items      BOOLEAN NOT NULL DEFAULT true,
  packet_expiry_hours        INTEGER NOT NULL DEFAULT 72 CHECK (packet_expiry_hours BETWEEN 1 AND 2160),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT research_calendar_day_post_order CHECK (min_posts <= target_posts AND target_posts <= max_posts),
  CONSTRAINT research_calendar_day_theme_key_check CHECK (
    theme_key ~ '^[a-z][a-z0-9_-]{1,79}$'
    AND char_length(theme_name) BETWEEN 3 AND 160
    AND (theme_description IS NULL OR char_length(theme_description) <= 1000)
  ),
  CONSTRAINT research_calendar_day_array_bounds_check CHECK (
    cardinality(keywords) <= 40
    AND cardinality(target_audience) <= 40
    AND cardinality(content_types) BETWEEN 1 AND 8
    AND cardinality(preferred_persona_slugs) <= 40
    AND cardinality(source_priority) <= 40
  ),
  CONSTRAINT research_calendar_day_theme_unique UNIQUE (calendar_id, weekday, sort_order)
);

CREATE TABLE IF NOT EXISTS public.research_schedule_runs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id              UUID NOT NULL REFERENCES public.research_editorial_calendars(id) ON DELETE CASCADE,
  calendar_day_id          UUID REFERENCES public.research_calendar_days(id) ON DELETE SET NULL,
  agent_job_id             UUID REFERENCES public.agent_jobs(id) ON DELETE SET NULL,
  execution_token          UUID,
  trigger_type             TEXT NOT NULL CHECK (trigger_type IN ('scheduled','manual','retry')),
  scheduled_for            TIMESTAMPTZ,
  idempotency_key          TEXT NOT NULL UNIQUE,
  status                   TEXT NOT NULL DEFAULT 'queued'
                             CHECK (status IN ('queued','running','succeeded','partial','no_good_topic','failed','cancelled','skipped')),
  packets_produced         INTEGER NOT NULL DEFAULT 0,
  drafts_produced          INTEGER NOT NULL DEFAULT 0,
  source_failures_json     JSONB NOT NULL DEFAULT '[]'::jsonb,
  result_json              JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code               TEXT,
  error_message            TEXT,
  notification_sent       BOOLEAN NOT NULL DEFAULT false,
  started_at               TIMESTAMPTZ,
  finished_at              TIMESTAMPTZ,
  packets_persisted_at     TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT research_schedule_runs_counts_check CHECK (
    packets_produced >= 0 AND drafts_produced >= 0
  ),
  CONSTRAINT research_schedule_runs_json_check CHECK (
    jsonb_typeof(source_failures_json) = 'array'
    AND jsonb_typeof(result_json) = 'object'
  ),
  CONSTRAINT research_schedule_runs_text_check CHECK (
    char_length(idempotency_key) BETWEEN 1 AND 255
    AND (error_code IS NULL OR char_length(error_code) <= 120)
    AND (error_message IS NULL OR char_length(error_message) <= 2000)
  ),
  CONSTRAINT research_schedule_runs_execution_fence_check CHECK (
    (status = 'running' AND execution_token IS NOT NULL AND finished_at IS NULL)
    OR (status <> 'running' AND execution_token IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.research_packets (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_run_id          UUID NOT NULL REFERENCES public.research_schedule_runs(id) ON DELETE CASCADE,
  calendar_day_id          UUID REFERENCES public.research_calendar_days(id) ON DELETE SET NULL,
  theme_key                TEXT NOT NULL,
  theme_name               TEXT NOT NULL,
  target_audience          TEXT[] NOT NULL DEFAULT '{}',
  suggested_personas       TEXT[] NOT NULL DEFAULT '{}',
  topic_title              TEXT NOT NULL,
  topic_angle              TEXT NOT NULL,
  summary                  TEXT NOT NULL,
  findings_json            JSONB NOT NULL DEFAULT '[]'::jsonb,
  product_candidate_ids    UUID[] NOT NULL DEFAULT '{}',
  source_refs_json         JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_score         NUMERIC(5,2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  urgency                  TEXT NOT NULL DEFAULT 'low' CHECK (urgency IN ('low','medium','high')),
  content_type             TEXT NOT NULL
                             CHECK (content_type IN ('news','software-guide','buying-guide','comparison','deal-roundup','trust-education','weekly-roundup','evergreen')),
  monetization_intent      TEXT NOT NULL DEFAULT 'none'
                             CHECK (monetization_intent IN ('none','soft-contextual','product-cards','comparison-links')),
  status                   TEXT NOT NULL DEFAULT 'draft_packet'
                             CHECK (status IN ('draft_packet','ready_for_blog','needs_admin_review','used','rejected','expired')),
  expires_at               TIMESTAMPTZ,
  used_at                  TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT research_packets_json_check CHECK (
    jsonb_typeof(findings_json) = 'array'
    AND jsonb_typeof(source_refs_json) = 'array'
  ),
  CONSTRAINT research_packets_text_check CHECK (
    char_length(theme_key) BETWEEN 1 AND 80
    AND char_length(theme_name) BETWEEN 3 AND 160
    AND char_length(topic_title) BETWEEN 5 AND 240
    AND char_length(topic_angle) BETWEEN 10 AND 2000
    AND char_length(summary) BETWEEN 20 AND 4000
  )
);

CREATE INDEX IF NOT EXISTS research_calendar_days_due_idx
  ON public.research_calendar_days (calendar_id, weekday, enabled, run_time);
CREATE INDEX IF NOT EXISTS research_schedule_runs_recent_idx
  ON public.research_schedule_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS research_schedule_runs_day_idx
  ON public.research_schedule_runs (calendar_day_id, created_at DESC);
CREATE INDEX IF NOT EXISTS research_packets_queue_idx
  ON public.research_packets (status, confidence_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS research_packets_expiry_idx
  ON public.research_packets (expires_at) WHERE expires_at IS NOT NULL;

DROP TRIGGER IF EXISTS research_editorial_calendars_updated_at ON public.research_editorial_calendars;
CREATE TRIGGER research_editorial_calendars_updated_at
  BEFORE UPDATE ON public.research_editorial_calendars
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS research_calendar_days_updated_at ON public.research_calendar_days;
CREATE TRIGGER research_calendar_days_updated_at
  BEFORE UPDATE ON public.research_calendar_days
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS research_packets_updated_at ON public.research_packets;
CREATE TRIGGER research_packets_updated_at
  BEFORE UPDATE ON public.research_packets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.research_editorial_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_calendar_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_schedule_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_packets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.research_editorial_calendars FORCE ROW LEVEL SECURITY;
ALTER TABLE public.research_calendar_days FORCE ROW LEVEL SECURITY;
ALTER TABLE public.research_schedule_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.research_packets FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.research_editorial_calendars FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.research_calendar_days FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.research_schedule_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.research_packets FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.research_editorial_calendars
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.research_calendar_days
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.research_schedule_runs
  TO service_role;
-- Packet inserts go through persist_research_packets so the job/run execution
-- token is checked in the same transaction as the insert.
GRANT SELECT, UPDATE, DELETE ON TABLE public.research_packets
  TO service_role;

-- Execution-fenced scheduler functions --------------------------------------
-- Every function locks the agent job before its schedule run. Keeping one
-- lock order avoids deadlocks between normal completion and lease recovery.
CREATE OR REPLACE FUNCTION public.claim_research_schedule_run(
  p_calendar_id UUID,
  p_calendar_day_id UUID,
  p_agent_job_id UUID,
  p_execution_token UUID,
  p_trigger_type TEXT,
  p_scheduled_for TIMESTAMPTZ,
  p_idempotency_key TEXT,
  p_started_at TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_job public.agent_jobs%ROWTYPE;
  v_run public.research_schedule_runs%ROWTYPE;
BEGIN
  IF p_trigger_type NOT IN ('scheduled', 'manual', 'retry') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_research_trigger_type';
  END IF;

  SELECT job.* INTO v_job
  FROM public.agent_jobs AS job
  WHERE job.id = p_agent_job_id
    AND job.job_type = 'research.calendar'
    AND job.status = 'running'
    AND job.lock_token = p_execution_token
    AND job.lock_expires_at > clock_timestamp()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'research_execution_stale';
  END IF;

  SELECT run.* INTO v_run
  FROM public.research_schedule_runs AS run
  WHERE run.idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.research_schedule_runs (
      calendar_id,
      calendar_day_id,
      agent_job_id,
      execution_token,
      trigger_type,
      scheduled_for,
      idempotency_key,
      status,
      started_at
    ) VALUES (
      p_calendar_id,
      p_calendar_day_id,
      p_agent_job_id,
      p_execution_token,
      p_trigger_type,
      p_scheduled_for,
      p_idempotency_key,
      'running',
      p_started_at
    )
    RETURNING * INTO v_run;
    RETURN jsonb_build_object('run', to_jsonb(v_run), 'duplicate', false);
  END IF;

  IF v_run.calendar_id <> p_calendar_id
    OR v_run.calendar_day_id IS DISTINCT FROM p_calendar_day_id THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'research_schedule_conflict';
  END IF;

  IF p_trigger_type = 'retry'
    AND v_run.status IN ('failed', 'running')
    AND v_run.execution_token IS DISTINCT FROM p_execution_token THEN
    UPDATE public.research_schedule_runs
    SET agent_job_id = p_agent_job_id,
        execution_token = p_execution_token,
        trigger_type = 'retry',
        scheduled_for = p_scheduled_for,
        status = 'running',
        source_failures_json = '[]'::jsonb,
        result_json = '{}'::jsonb,
        error_code = NULL,
        error_message = NULL,
        started_at = p_started_at,
        finished_at = NULL
    WHERE id = v_run.id
    RETURNING * INTO v_run;
    RETURN jsonb_build_object('run', to_jsonb(v_run), 'duplicate', false);
  END IF;

  RETURN jsonb_build_object('run', to_jsonb(v_run), 'duplicate', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.research_execution_is_active(
  p_schedule_run_id UUID,
  p_agent_job_id UUID,
  p_execution_token UUID
) RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.research_schedule_runs AS run
    JOIN public.agent_jobs AS job ON job.id = run.agent_job_id
    WHERE run.id = p_schedule_run_id
      AND run.agent_job_id = p_agent_job_id
      AND run.status = 'running'
      AND run.execution_token = p_execution_token
      AND job.status = 'running'
      AND job.lock_token = p_execution_token
      AND job.lock_expires_at > clock_timestamp()
  );
$$;

CREATE OR REPLACE FUNCTION public.persist_research_packets(
  p_schedule_run_id UUID,
  p_agent_job_id UUID,
  p_execution_token UUID,
  p_packets JSONB
) RETURNS SETOF public.research_packets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_job public.agent_jobs%ROWTYPE;
  v_run public.research_schedule_runs%ROWTYPE;
BEGIN
  IF p_packets IS NULL
    OR jsonb_typeof(p_packets) <> 'array'
    OR jsonb_array_length(p_packets) > 20 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_research_packet_batch';
  END IF;

  SELECT job.* INTO v_job
  FROM public.agent_jobs AS job
  WHERE job.id = p_agent_job_id
    AND job.job_type = 'research.calendar'
    AND job.status = 'running'
    AND job.lock_token = p_execution_token
    AND job.lock_expires_at > clock_timestamp()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'research_execution_stale';
  END IF;

  SELECT run.* INTO v_run
  FROM public.research_schedule_runs AS run
  WHERE run.id = p_schedule_run_id
    AND run.agent_job_id = p_agent_job_id
    AND run.status = 'running'
    AND run.execution_token = p_execution_token
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'research_execution_stale';
  END IF;

  IF v_run.packets_persisted_at IS NOT NULL THEN
    RETURN QUERY
      SELECT packet.*
      FROM public.research_packets AS packet
      WHERE packet.schedule_run_id = p_schedule_run_id
      ORDER BY packet.created_at, packet.id;
    RETURN;
  END IF;

  UPDATE public.research_schedule_runs
  SET packets_persisted_at = clock_timestamp()
  WHERE id = p_schedule_run_id;

  RETURN QUERY
  INSERT INTO public.research_packets (
    schedule_run_id,
    calendar_day_id,
    theme_key,
    theme_name,
    target_audience,
    suggested_personas,
    topic_title,
    topic_angle,
    summary,
    findings_json,
    product_candidate_ids,
    source_refs_json,
    confidence_score,
    urgency,
    content_type,
    monetization_intent,
    status,
    expires_at
  )
  SELECT
    p_schedule_run_id,
    v_run.calendar_day_id,
    item.value->>'theme_key',
    item.value->>'theme_name',
    ARRAY(
      SELECT jsonb_array_elements_text(
        COALESCE(item.value->'target_audience', '[]'::jsonb)
      )
    ),
    ARRAY(
      SELECT jsonb_array_elements_text(
        COALESCE(item.value->'suggested_personas', '[]'::jsonb)
      )
    ),
    item.value->>'topic_title',
    item.value->>'topic_angle',
    item.value->>'summary',
    COALESCE(item.value->'findings_json', '[]'::jsonb),
    '{}'::UUID[],
    COALESCE(item.value->'source_refs_json', '[]'::jsonb),
    (item.value->>'confidence_score')::NUMERIC,
    item.value->>'urgency',
    item.value->>'content_type',
    item.value->>'monetization_intent',
    item.value->>'status',
    NULLIF(item.value->>'expires_at', '')::TIMESTAMPTZ
  FROM jsonb_array_elements(p_packets) AS item(value)
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_research_schedule_run(
  p_schedule_run_id UUID,
  p_agent_job_id UUID,
  p_execution_token UUID,
  p_expected_started_at TIMESTAMPTZ,
  p_status TEXT,
  p_packets_produced INTEGER,
  p_drafts_produced INTEGER,
  p_result JSONB,
  p_error_code TEXT,
  p_error_message TEXT,
  p_source_failures JSONB,
  p_finished_at TIMESTAMPTZ
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_job public.agent_jobs%ROWTYPE;
  v_run public.research_schedule_runs%ROWTYPE;
BEGIN
  IF p_status NOT IN (
    'succeeded', 'partial', 'no_good_topic', 'failed', 'cancelled', 'skipped'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_research_run_status';
  END IF;

  SELECT job.* INTO v_job
  FROM public.agent_jobs AS job
  WHERE job.id = p_agent_job_id
    AND job.job_type = 'research.calendar'
    AND job.status = 'running'
    AND job.lock_token = p_execution_token
    AND job.lock_expires_at > clock_timestamp()
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT run.* INTO v_run
  FROM public.research_schedule_runs AS run
  WHERE run.id = p_schedule_run_id
    AND run.agent_job_id = p_agent_job_id
    AND run.status = 'running'
    AND run.execution_token = p_execution_token
    AND run.started_at = p_expected_started_at
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.research_schedule_runs
  SET status = p_status,
      execution_token = NULL,
      packets_produced = p_packets_produced,
      drafts_produced = p_drafts_produced,
      result_json = p_result,
      error_code = p_error_code,
      error_message = p_error_message,
      source_failures_json = p_source_failures,
      finished_at = p_finished_at
  WHERE id = p_schedule_run_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.reclaim_research_calendar_lease(
  p_agent_job_id UUID,
  p_execution_token UUID,
  p_expected_lock_expires_at TIMESTAMPTZ,
  p_now TIMESTAMPTZ
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_job public.agent_jobs%ROWTYPE;
  v_outcome TEXT;
BEGIN
  SELECT job.* INTO v_job
  FROM public.agent_jobs AS job
  WHERE job.id = p_agent_job_id
    AND job.job_type = 'research.calendar'
    AND job.status = 'running'
    AND job.lock_token = p_execution_token
    AND job.lock_expires_at = p_expected_lock_expires_at
    AND job.lock_expires_at <= p_now
  FOR UPDATE;
  IF NOT FOUND THEN RETURN 'skipped'; END IF;

  v_outcome := CASE
    WHEN v_job.attempt_count >= v_job.max_attempts THEN 'failed'
    ELSE 'requeued'
  END;

  UPDATE public.research_schedule_runs
  SET status = 'failed',
      execution_token = NULL,
      error_code = 'WORKER_LEASE_EXPIRED',
      error_message = 'The worker lease expired before this run completed.',
      finished_at = p_now
  WHERE agent_job_id = p_agent_job_id
    AND status = 'running'
    AND execution_token = p_execution_token;

  UPDATE public.agent_jobs
  SET status = CASE WHEN v_outcome = 'failed' THEN 'failed' ELSE 'queued' END,
      error_code = 'WORKER_LEASE_EXPIRED',
      error_message = 'The previous worker lease expired before completion.',
      next_retry_at = CASE WHEN v_outcome = 'requeued' THEN p_now ELSE NULL END,
      finished_at = CASE WHEN v_outcome = 'failed' THEN p_now ELSE NULL END,
      lock_owner = NULL,
      lock_token = NULL,
      locked_at = NULL,
      lock_expires_at = NULL
  WHERE id = p_agent_job_id;

  RETURN v_outcome;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_research_schedule_run(UUID, UUID, UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.research_execution_is_active(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_research_packets(UUID, UUID, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_research_schedule_run(UUID, UUID, UUID, TIMESTAMPTZ, TEXT, INTEGER, INTEGER, JSONB, TEXT, TEXT, JSONB, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reclaim_research_calendar_lease(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_research_schedule_run(UUID, UUID, UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TIMESTAMPTZ)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.research_execution_is_active(UUID, UUID, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.persist_research_packets(UUID, UUID, UUID, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_research_schedule_run(UUID, UUID, UUID, TIMESTAMPTZ, TEXT, INTEGER, INTEGER, JSONB, TEXT, TEXT, JSONB, TIMESTAMPTZ)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reclaim_research_calendar_lease(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO service_role;

-- Seed data only. Runtime behavior always reads these rows; weekday themes are
-- never hard-coded in the orchestrator.
INSERT INTO public.research_editorial_calendars (
  id, name, enabled, paused, timezone, mode, max_posts_per_day, max_posts_per_week
) VALUES (
  '00000000-0000-4000-8000-000000000026',
  'LaptopFinder Weekly Research Calendar',
  false,
  true,
  'Asia/Kolkata',
  'draft_only',
  2,
  7
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.research_calendar_days (
  id, calendar_id, weekday, sort_order, theme_key, theme_name, theme_description,
  keywords, target_audience, content_types, preferred_persona_slugs,
  source_priority, product_card_limit, approval_mode, affiliate_insertion_mode
) VALUES
  (
    '00000000-0000-4000-8000-000000000261', '00000000-0000-4000-8000-000000000026', 1, 0,
    'new-tech', 'New tech and hardware trends', 'Useful explainers about verified laptop hardware and platform changes.',
    ARRAY['laptop hardware','CPU','GPU','AI PC'], ARRAY['students','parents','professionals'],
    ARRAY['news','evergreen'], ARRAY['ai-ml-workstation-advisor','laptopfinder-editorial-guide'],
    ARRAY['official-manufacturer','official-platform','approved-web'], 0, 'draft_only', 'after_approval'
  ),
  (
    '00000000-0000-4000-8000-000000000262', '00000000-0000-4000-8000-000000000026', 2, 0,
    'software', 'Software requirements and updates', 'Official software requirements translated into practical laptop guidance.',
    ARRAY['system requirements','software update','laptop requirements'], ARRAY['design students','CSE students','creators'],
    ARRAY['software-guide'], ARRAY['design-software-mentor','coding-laptop-specialist'],
    ARRAY['official-software','official-documentation'], 0, 'draft_only', 'after_approval'
  ),
  (
    '00000000-0000-4000-8000-000000000263', '00000000-0000-4000-8000-000000000026', 3, 0,
    'course-guides', 'Course and program laptop guides', 'Decision guides grounded in course workflows rather than brand hype.',
    ARRAY['college laptop','course software','student laptop'], ARRAY['students','parents'],
    ARRAY['buying-guide'], ARRAY['design-software-mentor','coding-laptop-specialist','parent-buying-advisor'],
    ARRAY['official-curriculum','official-software','laptopfinder-catalog'], 0, 'draft_only', 'after_approval'
  ),
  (
    '00000000-0000-4000-8000-000000000264', '00000000-0000-4000-8000-000000000026', 4, 0,
    'deals-value', 'Deals, price movement, and value picks', 'API/feed-backed value research with strict freshness language.',
    ARRAY['laptop value','current offers','price movement'], ARRAY['budget buyers','students','parents'],
    ARRAY['deal-roundup','comparison'], ARRAY['budget-student-mentor','laptopfinder-editorial-guide'],
    ARRAY['amazon','flipkart','manual'], 3, 'draft_only', 'after_approval'
  ),
  (
    '00000000-0000-4000-8000-000000000265', '00000000-0000-4000-8000-000000000026', 5, 0,
    'trust', 'Brand, service, warranty, and trust', 'Evergreen buying-confidence guidance from official policy sources.',
    ARRAY['warranty','service','reliability','buying safely'], ARRAY['parents','first-time buyers','students'],
    ARRAY['trust-education','evergreen'], ARRAY['laptop-reliability-guide','parent-buying-advisor'],
    ARRAY['official-brand','official-warranty','laptopfinder-editorial'], 0, 'draft_only', 'never'
  ),
  (
    '00000000-0000-4000-8000-000000000266', '00000000-0000-4000-8000-000000000026', 6, 0,
    'comparisons-faqs', 'Comparisons and user FAQs', 'Answer recurring buying questions using approved catalog facts.',
    ARRAY['laptop comparison','buyer FAQ','Chip questions'], ARRAY['students','parents','professionals'],
    ARRAY['comparison','buying-guide'], ARRAY['laptopfinder-editorial-guide','coding-laptop-specialist'],
    ARRAY['laptopfinder-catalog','chip-insights','official-documentation'], 3, 'draft_only', 'after_approval'
  ),
  (
    '00000000-0000-4000-8000-000000000267', '00000000-0000-4000-8000-000000000026', 7, 0,
    'weekly-roundup', 'Weekly roundup and evergreen planning', 'A useful weekly synthesis and next-week editorial plan.',
    ARRAY['weekly laptop news','buying guide','editorial plan'], ARRAY['students','parents','professionals'],
    ARRAY['weekly-roundup','evergreen'], ARRAY['laptopfinder-editorial-guide','parent-buying-advisor'],
    ARRAY['approved-web','laptopfinder-catalog'], 0, 'draft_only', 'never'
  )
ON CONFLICT (id) DO NOTHING;
