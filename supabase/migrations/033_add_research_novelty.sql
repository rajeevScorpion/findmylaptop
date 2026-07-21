-- ============================================================================

BEGIN;
-- 033 - Deterministic research-topic novelty
-- ----------------------------------------------------------------------------
-- Adds saved calendar policy, auditable packet novelty metadata, and an atomic
-- exact-title claim used by persist_research_packets. Similarity decisions are
-- made by trusted application code; the database claim closes the race between
-- concurrent runs that accepted the same normalized title.
--
-- Requires: 032 (and all earlier migrations in sequence)
-- Rollback: 033_add_research_novelty_rollback.sql
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.research_editorial_calendars') IS NULL
     OR to_regclass('public.research_schedule_runs') IS NULL
     OR to_regclass('public.research_packets') IS NULL
     OR to_regclass('public.agent_jobs') IS NULL THEN
    RAISE EXCEPTION 'Required research-agent tables are missing';
  END IF;
END;
$$;

-- Keep this normalization deliberately small and reproducible in TypeScript:
-- lowercase, trim, and replace each non-alphanumeric run with one space. The
-- application and database must produce exactly the same readable value.
CREATE OR REPLACE FUNCTION public.research_topic_fingerprint(
  p_topic_title TEXT
) RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT COALESCE(
    NULLIF(
      btrim(
        regexp_replace(
          replace(
            replace(
              replace(lower(btrim(p_topic_title)), 'c++', ' cplusplus '),
              'c#', ' csharp '
            ),
            '.net', ' dotnet '
          ),
          '[^a-z0-9]+',
          ' ',
          'g'
        )
      ),
      ''
    ),
    lower(btrim(p_topic_title))
  );
$$;

REVOKE ALL ON FUNCTION public.research_topic_fingerprint(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.research_topic_fingerprint(TEXT)
  TO service_role;

ALTER TABLE public.research_editorial_calendars
  ADD COLUMN novelty_window_days INTEGER NOT NULL DEFAULT 180,
  ADD COLUMN novelty_similarity_threshold NUMERIC(5,2) NOT NULL DEFAULT 62,
  ADD COLUMN source_rotation_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD CONSTRAINT research_calendars_novelty_window_check
    CHECK (novelty_window_days BETWEEN 90 AND 365),
  ADD CONSTRAINT research_calendars_novelty_threshold_check
    CHECK (novelty_similarity_threshold BETWEEN 20 AND 95);

COMMENT ON COLUMN public.research_editorial_calendars.novelty_window_days IS
  'Days of packets and posts considered by deterministic topic novelty checks.';
COMMENT ON COLUMN public.research_editorial_calendars.novelty_similarity_threshold IS
  'Maximum allowed deterministic topic similarity on a 0-100 scale.';
COMMENT ON COLUMN public.research_editorial_calendars.source_rotation_enabled IS
  'Whether recent primary subjects and source domains should be rotated before research.';

ALTER TABLE public.research_schedule_runs
  ADD COLUMN outcome_reason_code TEXT,
  ADD CONSTRAINT research_schedule_runs_outcome_reason_check CHECK (
    (
      outcome_reason_code IS NULL
      OR outcome_reason_code IN (
        'duplicate_topic',
        'insufficient_freshness',
        'insufficient_evidence',
        'source_rotation',
        'no_qualifying_candidate',
        'source_configuration'
      )
    )
    AND (outcome_reason_code IS NULL OR status = 'no_good_topic')
  );

COMMENT ON COLUMN public.research_schedule_runs.outcome_reason_code IS
  'Typed no-topic outcome for migration-033 runs; legacy rows may remain unclassified.';

ALTER TABLE public.research_packets
  ADD COLUMN topic_fingerprint TEXT,
  ADD COLUMN novelty_score NUMERIC(5,2),
  ADD COLUMN nearest_topic_similarity NUMERIC(5,2),
  ADD COLUMN nearest_topic_kind TEXT,
  ADD COLUMN nearest_topic_id UUID,
  ADD COLUMN nearest_topic_title TEXT,
  ADD COLUMN novelty_window_days INTEGER,
  ADD COLUMN novelty_checked_at TIMESTAMPTZ,
  ADD COLUMN subject_key TEXT,
  ADD COLUMN source_domains TEXT[] NOT NULL DEFAULT '{}';

-- Existing packets become history baselines but are not assigned a fabricated
-- novelty score or check timestamp. Disabling the timestamp trigger preserves
-- their original updated_at audit value during the fingerprint backfill.
ALTER TABLE public.research_packets
  DISABLE TRIGGER research_packets_updated_at;

UPDATE public.research_packets
SET topic_fingerprint = public.research_topic_fingerprint(topic_title)
WHERE topic_fingerprint IS NULL;

ALTER TABLE public.research_packets
  ENABLE TRIGGER research_packets_updated_at;

ALTER TABLE public.research_packets
  ALTER COLUMN topic_fingerprint SET NOT NULL,
  ADD CONSTRAINT research_packets_topic_fingerprint_check CHECK (
    char_length(topic_fingerprint) BETWEEN 1 AND 1024
  ),
  ADD CONSTRAINT research_packets_novelty_score_check CHECK (
    novelty_score BETWEEN 0 AND 100
  ),
  ADD CONSTRAINT research_packets_nearest_similarity_check CHECK (
    nearest_topic_similarity IS NULL
    OR nearest_topic_similarity BETWEEN 0 AND 100
  ),
  ADD CONSTRAINT research_packets_nearest_kind_check CHECK (
    nearest_topic_kind IS NULL
    OR nearest_topic_kind IN ('research_packet', 'blog_post')
  ),
  ADD CONSTRAINT research_packets_novelty_window_check CHECK (
    novelty_window_days BETWEEN 90 AND 365
  ),
  ADD CONSTRAINT research_packets_novelty_text_check CHECK (
    (nearest_topic_title IS NULL OR char_length(nearest_topic_title) <= 1000)
    AND (subject_key IS NULL OR char_length(subject_key) BETWEEN 1 AND 160)
  ),
  ADD CONSTRAINT research_packets_source_domains_check CHECK (
    cardinality(source_domains) <= 64
  );

COMMENT ON COLUMN public.research_packets.topic_fingerprint IS
  'Database-canonical exact-title fingerprint; never trust a model-supplied value.';
COMMENT ON COLUMN public.research_packets.novelty_score IS
  'Deterministic novelty score on a 0-100 scale; higher means less similar to recent coverage.';
COMMENT ON COLUMN public.research_packets.nearest_topic_similarity IS
  'Similarity of the nearest compared packet or post on a 0-100 scale.';
COMMENT ON COLUMN public.research_packets.nearest_topic_id IS
  'Polymorphic reference to research_packets or blog_posts, selected by nearest_topic_kind.';
COMMENT ON COLUMN public.research_packets.source_domains IS
  'Normalized source hostnames used for deterministic source rotation and auditing.';

CREATE INDEX research_packets_fingerprint_idx
  ON public.research_packets (topic_fingerprint);
CREATE INDEX research_packets_subject_history_idx
  ON public.research_packets (subject_key, created_at DESC)
  WHERE subject_key IS NOT NULL;

-- A claim table keeps legacy duplicate rows intact while allowing only one
-- post-migration packet to claim an exact normalized title. Claims survive
-- packet deletion so deleting an artifact cannot make a covered title novel.
CREATE TABLE public.research_topic_claims (
  topic_fingerprint TEXT PRIMARY KEY,
  first_packet_id UUID REFERENCES public.research_packets(id) ON DELETE SET NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT research_topic_claims_fingerprint_check CHECK (
    char_length(topic_fingerprint) BETWEEN 1 AND 1024
  )
);

INSERT INTO public.research_topic_claims (
  topic_fingerprint,
  first_packet_id,
  first_seen_at
)
SELECT DISTINCT ON (packet.topic_fingerprint)
  packet.topic_fingerprint,
  packet.id,
  packet.created_at
FROM public.research_packets AS packet
ORDER BY packet.topic_fingerprint, packet.created_at, packet.id;

CREATE INDEX research_topic_claims_packet_idx
  ON public.research_topic_claims (first_packet_id)
  WHERE first_packet_id IS NOT NULL;

ALTER TABLE public.research_topic_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_topic_claims FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.research_topic_claims
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.research_topic_claims TO service_role;

COMMENT ON TABLE public.research_topic_claims IS
  'Atomic exact-title claims for research packets. Mutated only by execution-fenced functions.';

-- Serialize the history-read -> model -> deterministic-check -> persistence
-- section across research runs. Without this bounded lease, two manual runs
-- could read the same snapshot and persist differently worded versions of one
-- semantic topic before either became visible to the other.
CREATE TABLE public.research_novelty_lease (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  schedule_run_id UUID,
  agent_job_id UUID,
  execution_token UUID,
  lease_expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT research_novelty_lease_holder_check CHECK (
    (schedule_run_id IS NULL AND agent_job_id IS NULL AND execution_token IS NULL AND lease_expires_at IS NULL)
    OR
    (schedule_run_id IS NOT NULL AND agent_job_id IS NOT NULL AND execution_token IS NOT NULL AND lease_expires_at IS NOT NULL)
  )
);

INSERT INTO public.research_novelty_lease (id) VALUES (1);

ALTER TABLE public.research_novelty_lease ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_novelty_lease FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.research_novelty_lease
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.research_novelty_lease IS
  'Singleton bounded lease that serializes deterministic editorial topic selection.';

CREATE OR REPLACE FUNCTION public.claim_research_novelty_lease(
  p_schedule_run_id UUID,
  p_agent_job_id UUID,
  p_execution_token UUID,
  p_now TIMESTAMPTZ,
  p_lease_seconds INTEGER DEFAULT 1800
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_lease public.research_novelty_lease%ROWTYPE;
  v_job_lock_expires_at TIMESTAMPTZ;
BEGIN
  IF p_lease_seconds < 60 OR p_lease_seconds > 1800 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_research_novelty_lease_duration';
  END IF;

  SELECT job.lock_expires_at INTO v_job_lock_expires_at
  FROM public.research_schedule_runs AS run
  JOIN public.agent_jobs AS job ON job.id = run.agent_job_id
  WHERE run.id = p_schedule_run_id
    AND run.agent_job_id = p_agent_job_id
    AND run.status = 'running'
    AND run.execution_token = p_execution_token
    AND job.status = 'running'
    AND job.lock_token = p_execution_token
    AND job.lock_expires_at > p_now;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'research_execution_stale';
  END IF;

  SELECT * INTO v_lease
  FROM public.research_novelty_lease
  WHERE id = 1
  FOR UPDATE;

  IF v_lease.lease_expires_at > p_now
    AND (
      v_lease.schedule_run_id IS DISTINCT FROM p_schedule_run_id
      OR v_lease.execution_token IS DISTINCT FROM p_execution_token
    ) THEN
    RETURN false;
  END IF;

  UPDATE public.research_novelty_lease
  SET schedule_run_id = p_schedule_run_id,
      agent_job_id = p_agent_job_id,
      execution_token = p_execution_token,
      lease_expires_at = LEAST(
        p_now + make_interval(secs => p_lease_seconds),
        v_job_lock_expires_at
      ),
      updated_at = clock_timestamp()
  WHERE id = 1;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_research_novelty_lease(
  p_schedule_run_id UUID,
  p_agent_job_id UUID,
  p_execution_token UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.research_novelty_lease
  SET schedule_run_id = NULL,
      agent_job_id = NULL,
      execution_token = NULL,
      lease_expires_at = NULL,
      updated_at = clock_timestamp()
  WHERE id = 1
    AND schedule_run_id = p_schedule_run_id
    AND agent_job_id = p_agent_job_id
    AND execution_token = p_execution_token;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_research_novelty_lease(UUID, UUID, UUID, TIMESTAMPTZ, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_research_novelty_lease(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_research_novelty_lease(UUID, UUID, UUID, TIMESTAMPTZ, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_research_novelty_lease(UUID, UUID, UUID)
  TO service_role;

-- Preserve the original RPC signature. New metadata accepts camelCase keys,
-- with snake_case fallbacks. topicFingerprint is verified, then the trusted
-- database-derived value is persisted.
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
  v_novelty_lease public.research_novelty_lease%ROWTYPE;
  v_item JSONB;
  v_packet_id UUID;
  v_topic_fingerprint TEXT;
  v_supplied_fingerprint TEXT;
  v_claimed_fingerprint TEXT;
  v_source_domains TEXT[];
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

  -- Fence semantic selection as well as execution. Holding this singleton row
  -- through the insert prevents a waiting run from loading history until this
  -- transaction commits, and an expired/replaced selector cannot persist from
  -- its stale history snapshot.
  SELECT * INTO v_novelty_lease
  FROM public.research_novelty_lease
  WHERE id = 1
  FOR UPDATE;
  IF v_novelty_lease.schedule_run_id IS DISTINCT FROM p_schedule_run_id
    OR v_novelty_lease.agent_job_id IS DISTINCT FROM p_agent_job_id
    OR v_novelty_lease.execution_token IS DISTINCT FROM p_execution_token
    OR v_novelty_lease.lease_expires_at IS NULL
    OR v_novelty_lease.lease_expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'research_novelty_lease_stale';
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

  FOR v_item IN
    SELECT item.value
    FROM jsonb_array_elements(p_packets) WITH ORDINALITY AS item(value, ordinal)
    ORDER BY public.research_topic_fingerprint(item.value->>'topic_title'), item.ordinal
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_research_packet';
    END IF;

    v_topic_fingerprint := public.research_topic_fingerprint(v_item->>'topic_title');
    v_supplied_fingerprint := NULLIF(
      COALESCE(v_item->>'topicFingerprint', v_item->>'topic_fingerprint'),
      ''
    );
    IF v_supplied_fingerprint IS NOT NULL
      AND v_supplied_fingerprint <> v_topic_fingerprint THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023',
        MESSAGE = 'research_topic_fingerprint_mismatch';
    END IF;

    SELECT ARRAY(
      SELECT normalized.domain
      FROM (
        SELECT DISTINCT lower(btrim(domain.value)) AS domain
        FROM jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(v_item->'sourceDomains') = 'array'
              THEN v_item->'sourceDomains'
            WHEN jsonb_typeof(v_item->'source_domains') = 'array'
              THEN v_item->'source_domains'
            ELSE '[]'::jsonb
          END
        ) AS domain(value)
      ) AS normalized
      WHERE normalized.domain <> ''
      ORDER BY normalized.domain
    ) INTO v_source_domains;

    v_claimed_fingerprint := NULL;
    INSERT INTO public.research_topic_claims (
      topic_fingerprint,
      first_seen_at
    ) VALUES (
      v_topic_fingerprint,
      clock_timestamp()
    )
    ON CONFLICT (topic_fingerprint) DO NOTHING
    RETURNING topic_fingerprint INTO v_claimed_fingerprint;

    IF v_claimed_fingerprint IS NULL THEN
      CONTINUE;
    END IF;

    v_packet_id := gen_random_uuid();
    RETURN QUERY
    INSERT INTO public.research_packets (
      id, schedule_run_id, calendar_day_id, theme_key, theme_name,
      target_audience, suggested_personas, topic_title, topic_angle, summary,
      findings_json, product_candidate_ids, source_refs_json, confidence_score,
      urgency, content_type, monetization_intent, status, expires_at,
      topic_fingerprint, novelty_score, nearest_topic_similarity,
      nearest_topic_kind, nearest_topic_id, nearest_topic_title,
      novelty_window_days, novelty_checked_at, subject_key, source_domains
    ) VALUES (
      v_packet_id,
      p_schedule_run_id,
      v_run.calendar_day_id,
      v_item->>'theme_key',
      v_item->>'theme_name',
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_item->'target_audience', '[]'::jsonb))),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_item->'suggested_personas', '[]'::jsonb))),
      v_item->>'topic_title',
      v_item->>'topic_angle',
      v_item->>'summary',
      COALESCE(v_item->'findings_json', '[]'::jsonb),
      '{}'::UUID[],
      COALESCE(v_item->'source_refs_json', '[]'::jsonb),
      (v_item->>'confidence_score')::NUMERIC,
      v_item->>'urgency',
      v_item->>'content_type',
      v_item->>'monetization_intent',
      v_item->>'status',
      NULLIF(v_item->>'expires_at', '')::TIMESTAMPTZ,
      v_topic_fingerprint,
      NULLIF(COALESCE(v_item->>'noveltyScore', v_item->>'novelty_score'), '')::NUMERIC,
      NULLIF(COALESCE(v_item->>'nearestTopicSimilarity', v_item->>'nearest_topic_similarity'), '')::NUMERIC,
      NULLIF(COALESCE(v_item->>'nearestTopicKind', v_item->>'nearest_topic_kind'), ''),
      NULLIF(COALESCE(v_item->>'nearestTopicId', v_item->>'nearest_topic_id'), '')::UUID,
      NULLIF(COALESCE(v_item->>'nearestTopicTitle', v_item->>'nearest_topic_title'), ''),
      NULLIF(COALESCE(v_item->>'noveltyWindowDays', v_item->>'novelty_window_days'), '')::INTEGER,
      NULLIF(COALESCE(v_item->>'noveltyCheckedAt', v_item->>'novelty_checked_at'), '')::TIMESTAMPTZ,
      NULLIF(COALESCE(v_item->>'subjectKey', v_item->>'subject_key'), ''),
      v_source_domains
    )
    RETURNING *;

    UPDATE public.research_topic_claims
    SET first_packet_id = v_packet_id
    WHERE topic_fingerprint = v_topic_fingerprint
      AND first_packet_id IS NULL;
  END LOOP;
END;
$$;

-- Keep no_good_topic as the workflow status and classify its cause separately.
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
  v_outcome_reason_code TEXT;
BEGIN
  IF p_status NOT IN (
    'succeeded', 'partial', 'no_good_topic', 'failed', 'cancelled', 'skipped'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_research_run_status';
  END IF;

  v_outcome_reason_code := NULLIF(p_result->>'outcomeReasonCode', '');
  IF v_outcome_reason_code IS NOT NULL
    AND v_outcome_reason_code NOT IN (
      'duplicate_topic', 'insufficient_freshness', 'insufficient_evidence',
      'source_rotation', 'no_qualifying_candidate', 'source_configuration'
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_research_outcome_reason';
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
      outcome_reason_code = CASE
        WHEN p_status = 'no_good_topic' THEN
          COALESCE(v_outcome_reason_code, 'no_qualifying_candidate')
        ELSE NULL
      END,
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

COMMIT;
