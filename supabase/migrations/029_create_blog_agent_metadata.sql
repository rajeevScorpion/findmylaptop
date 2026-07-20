-- ============================================================================
-- 029 - Blogging Agent draft evidence and quality metadata (ADDITIVE ONLY)
-- ----------------------------------------------------------------------------
-- Research packets remain the topic queue. This table records the evidence,
-- checks, and model metadata behind each generated draft without exposing the
-- restricted research packet tables to browser clients.
-- Requires: 024, 026, 027
-- Rollback: 029_create_blog_agent_metadata_rollback.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.blog_agent_drafts (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key                 TEXT NOT NULL UNIQUE,
  generation_token                UUID NOT NULL DEFAULT gen_random_uuid(),
  upstream_execution_token        UUID,
  agent_job_id                    UUID REFERENCES public.agent_jobs(id) ON DELETE SET NULL,
  research_packet_id              UUID NOT NULL REFERENCES public.research_packets(id) ON DELETE RESTRICT,
  blog_post_id                    UUID REFERENCES public.blog_posts(id) ON DELETE SET NULL,
  persona_id                      UUID REFERENCES public.blog_author_personas(id) ON DELETE SET NULL,
  persona_version                 INTEGER,
  status                          TEXT NOT NULL DEFAULT 'generating'
                                    CHECK (status IN ('generating','generated','needs_review','quality_blocked','failed','cancelled')),
  quality_score                   NUMERIC(5,2) CHECK (quality_score BETWEEN 0 AND 100),
  quality_threshold               NUMERIC(5,2) NOT NULL CHECK (quality_threshold BETWEEN 0 AND 100),
  fact_check_json                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_refs_json                JSONB NOT NULL DEFAULT '[]'::jsonb,
  internal_link_suggestions_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  generation_model                TEXT,
  prompt_version                  TEXT,
  error_code                      TEXT,
  error_message                   TEXT,
  created_by                      TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT blog_agent_drafts_idempotency_check
    CHECK (char_length(idempotency_key) BETWEEN 1 AND 255),
  CONSTRAINT blog_agent_drafts_persona_version_check
    CHECK (
      (persona_id IS NULL AND (persona_version IS NULL OR persona_version >= 1))
      OR (
        persona_id IS NOT NULL
        AND persona_version IS NOT NULL
        AND persona_version >= 1
      )
    ),
  CONSTRAINT blog_agent_drafts_json_check
    CHECK (
      jsonb_typeof(fact_check_json) = 'array'
      AND jsonb_typeof(source_refs_json) = 'array'
      AND jsonb_typeof(internal_link_suggestions_json) = 'array'
    ),
  CONSTRAINT blog_agent_drafts_error_length_check
    CHECK (
      (generation_model IS NULL OR char_length(generation_model) <= 200)
      AND (prompt_version IS NULL OR char_length(prompt_version) <= 120)
      AND (error_code IS NULL OR char_length(error_code) <= 120)
      AND (error_message IS NULL OR char_length(error_message) <= 2000)
      AND (created_by IS NULL OR char_length(created_by) <= 320)
    )
);

COMMENT ON TABLE public.blog_agent_drafts IS
  'Server-only evidence, quality checks, and model metadata for Blogging Agent drafts. No credentials or raw source pages.';

CREATE INDEX IF NOT EXISTS blog_agent_drafts_packet_idx
  ON public.blog_agent_drafts (research_packet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS blog_agent_drafts_post_idx
  ON public.blog_agent_drafts (blog_post_id)
  WHERE blog_post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS blog_agent_drafts_review_idx
  ON public.blog_agent_drafts (status, quality_score, created_at DESC);

DROP TRIGGER IF EXISTS blog_agent_drafts_updated_at ON public.blog_agent_drafts;
CREATE TRIGGER blog_agent_drafts_updated_at
  BEFORE UPDATE ON public.blog_agent_drafts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.blog_agent_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_agent_drafts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.blog_agent_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_agent_drafts TO service_role;

-- Atomically verify the current generation/job leases, create the CMS draft,
-- and attach it to the artifact. A stale worker can never insert an orphaned
-- post because the lease check and insert share one database transaction.
CREATE OR REPLACE FUNCTION public.persist_blog_agent_post(
  p_artifact_id UUID,
  p_generation_token UUID,
  p_agent_job_id UUID,
  p_agent_job_lock_token UUID,
  p_post JSONB,
  p_quality_score NUMERIC,
  p_fact_check JSONB,
  p_source_refs JSONB,
  p_internal_links JSONB,
  p_generation_model TEXT,
  p_prompt_version TEXT
)
RETURNS TABLE (blog_post_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_artifact public.blog_agent_drafts%ROWTYPE;
  v_post_id UUID := gen_random_uuid();
BEGIN
  SELECT *
  INTO v_artifact
  FROM public.blog_agent_drafts
  WHERE id = p_artifact_id
    AND generation_token = p_generation_token
    AND status = 'generating'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '40001',
      MESSAGE = 'Blog generation lease changed before persistence.';
  END IF;

  IF (p_agent_job_id IS NULL) <> (p_agent_job_lock_token IS NULL) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Both agent job lease values are required together.';
  END IF;

  IF p_agent_job_id IS NOT NULL THEN
    PERFORM 1
    FROM public.agent_jobs
    WHERE id = p_agent_job_id
      AND status = 'running'
      AND lock_token = p_agent_job_lock_token
      AND lock_expires_at > now();
    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = '40001',
        MESSAGE = 'Upstream agent job lease changed before persistence.';
    END IF;
  END IF;

  INSERT INTO public.blog_posts (
    id,
    title,
    slug,
    excerpt,
    content_json,
    toc_json,
    status,
    template_type,
    audience,
    primary_keyword,
    secondary_keywords,
    meta_title,
    meta_description,
    og_title,
    og_description,
    reading_time_minutes,
    category_id,
    ai_inputs,
    author_persona_id,
    author_persona_version,
    author_persona_snapshot_json,
    author_type,
    persona_selection_reason,
    persona_generated,
    research_input_ids,
    created_by,
    updated_by
  ) VALUES (
    v_post_id,
    p_post->>'title',
    p_post->>'slug',
    p_post->>'excerpt',
    p_post->'content_json',
    p_post->'toc_json',
    'ai_generated',
    p_post->>'template_type',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_post->'audience', '[]'::jsonb))),
    p_post->>'primary_keyword',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_post->'secondary_keywords', '[]'::jsonb))),
    p_post->>'meta_title',
    p_post->>'meta_description',
    p_post->>'og_title',
    p_post->>'og_description',
    (p_post->>'reading_time_minutes')::INTEGER,
    NULLIF(p_post->>'category_id', '')::UUID,
    p_post->'ai_inputs',
    v_artifact.persona_id,
    v_artifact.persona_version,
    p_post->'author_persona_snapshot_json',
    p_post->>'author_type',
    p_post->>'persona_selection_reason',
    COALESCE((p_post->>'persona_generated')::BOOLEAN, false),
    ARRAY[v_artifact.research_packet_id],
    v_artifact.created_by,
    v_artifact.created_by
  );

  UPDATE public.blog_agent_drafts
  SET blog_post_id = v_post_id,
      status = 'needs_review',
      quality_score = p_quality_score,
      fact_check_json = p_fact_check,
      source_refs_json = p_source_refs,
      internal_link_suggestions_json = p_internal_links,
      generation_model = p_generation_model,
      prompt_version = p_prompt_version,
      error_code = NULL,
      error_message = NULL
  WHERE id = v_artifact.id
    AND generation_token = p_generation_token;

  RETURN QUERY SELECT v_post_id;
END;
$$;

REVOKE ALL ON FUNCTION public.persist_blog_agent_post(
  UUID, UUID, UUID, UUID, JSONB, NUMERIC, JSONB, JSONB, JSONB, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_blog_agent_post(
  UUID, UUID, UUID, UUID, JSONB, NUMERIC, JSONB, JSONB, JSONB, TEXT, TEXT
) TO service_role;
