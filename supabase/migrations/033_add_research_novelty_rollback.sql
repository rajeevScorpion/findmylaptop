-- ============================================================================

BEGIN;
-- Rollback 033 - Remove deterministic research-topic novelty
-- ----------------------------------------------------------------------------
-- Restore the migration-026 RPCs before removing objects referenced by the
-- migration-033 implementations. Novelty audit metadata is destroyed.
-- ============================================================================

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
    schedule_run_id, calendar_day_id, theme_key, theme_name, target_audience,
    suggested_personas, topic_title, topic_angle, summary, findings_json,
    product_candidate_ids, source_refs_json, confidence_score, urgency,
    content_type, monetization_intent, status, expires_at
  )
  SELECT
    p_schedule_run_id,
    v_run.calendar_day_id,
    item.value->>'theme_key',
    item.value->>'theme_name',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(item.value->'target_audience', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(item.value->'suggested_personas', '[]'::jsonb))),
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

REVOKE ALL ON FUNCTION public.persist_research_packets(UUID, UUID, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_research_schedule_run(UUID, UUID, UUID, TIMESTAMPTZ, TEXT, INTEGER, INTEGER, JSONB, TEXT, TEXT, JSONB, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_research_packets(UUID, UUID, UUID, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_research_schedule_run(UUID, UUID, UUID, TIMESTAMPTZ, TEXT, INTEGER, INTEGER, JSONB, TEXT, TEXT, JSONB, TIMESTAMPTZ)
  TO service_role;

DROP FUNCTION IF EXISTS public.release_research_novelty_lease(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.claim_research_novelty_lease(UUID, UUID, UUID, TIMESTAMPTZ, INTEGER);
DROP TABLE IF EXISTS public.research_novelty_lease;

DROP TABLE IF EXISTS public.research_topic_claims;

DROP INDEX IF EXISTS public.research_packets_subject_history_idx;
DROP INDEX IF EXISTS public.research_packets_fingerprint_idx;

ALTER TABLE public.research_packets
  DROP CONSTRAINT IF EXISTS research_packets_source_domains_check,
  DROP CONSTRAINT IF EXISTS research_packets_novelty_text_check,
  DROP CONSTRAINT IF EXISTS research_packets_novelty_window_check,
  DROP CONSTRAINT IF EXISTS research_packets_nearest_kind_check,
  DROP CONSTRAINT IF EXISTS research_packets_nearest_similarity_check,
  DROP CONSTRAINT IF EXISTS research_packets_novelty_score_check,
  DROP CONSTRAINT IF EXISTS research_packets_topic_fingerprint_check,
  DROP COLUMN IF EXISTS source_domains,
  DROP COLUMN IF EXISTS subject_key,
  DROP COLUMN IF EXISTS novelty_checked_at,
  DROP COLUMN IF EXISTS novelty_window_days,
  DROP COLUMN IF EXISTS nearest_topic_title,
  DROP COLUMN IF EXISTS nearest_topic_id,
  DROP COLUMN IF EXISTS nearest_topic_kind,
  DROP COLUMN IF EXISTS nearest_topic_similarity,
  DROP COLUMN IF EXISTS novelty_score,
  DROP COLUMN IF EXISTS topic_fingerprint;

ALTER TABLE public.research_schedule_runs
  DROP CONSTRAINT IF EXISTS research_schedule_runs_outcome_reason_check,
  DROP COLUMN IF EXISTS outcome_reason_code;

ALTER TABLE public.research_editorial_calendars
  DROP CONSTRAINT IF EXISTS research_calendars_novelty_threshold_check,
  DROP CONSTRAINT IF EXISTS research_calendars_novelty_window_check,
  DROP COLUMN IF EXISTS source_rotation_enabled,
  DROP COLUMN IF EXISTS novelty_similarity_threshold,
  DROP COLUMN IF EXISTS novelty_window_days;

DROP FUNCTION IF EXISTS public.research_topic_fingerprint(TEXT);

COMMIT;
