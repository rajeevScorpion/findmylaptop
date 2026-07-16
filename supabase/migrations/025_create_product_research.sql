-- ============================================================================
-- 025 - Product research candidates and multi-source offers (ADDITIVE ONLY)
-- ----------------------------------------------------------------------------
-- Adds a server-only review queue and source-neutral offers. The existing
-- public.laptops.amazon_affiliate_url column is intentionally preserved and is
-- not altered; product_offers is the additive multi-source model.
-- Requires: 024_create_agent_foundations.sql
-- Rollback: 025_create_product_research_rollback.sql
-- ============================================================================

-- Product candidates --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_candidates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_job_id      UUID REFERENCES public.agent_jobs(id) ON DELETE SET NULL,
  source_key            TEXT NOT NULL,
  source_product_id     TEXT,
  dedupe_key            TEXT NOT NULL,
  raw_payload_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalized_json       JSONB NOT NULL,
  title                 TEXT NOT NULL,
  brand                 TEXT,
  model                 TEXT,
  price_amount          NUMERIC(12,2),
  price_currency        TEXT,
  price_fetched_at      TIMESTAMPTZ,
  product_url           TEXT NOT NULL,
  affiliate_url         TEXT,
  image_url             TEXT,
  source_fetched_at     TIMESTAMPTZ NOT NULL,
  fresh_until           TIMESTAMPTZ,
  confidence_score      NUMERIC(5,2) NOT NULL DEFAULT 0,
  fit_score             NUMERIC(5,2) NOT NULL DEFAULT 0,
  fit_tags              TEXT[] NOT NULL DEFAULT '{}',
  risk_tags             TEXT[] NOT NULL DEFAULT '{}',
  compliance_status     TEXT NOT NULL DEFAULT 'needs_review',
  review_status         TEXT NOT NULL DEFAULT 'pending',
  admin_notes           TEXT,
  error_message         TEXT,
  reviewed_by           TEXT,
  reviewed_at           TIMESTAMPTZ,
  promoted_laptop_id    UUID REFERENCES public.laptops(id) ON DELETE RESTRICT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT product_candidates_source_key_check
    CHECK (source_key ~ '^[a-z][a-z0-9_-]{0,63}$'),
  CONSTRAINT product_candidates_source_product_id_length_check
    CHECK (source_product_id IS NULL OR char_length(source_product_id) BETWEEN 1 AND 256),
  CONSTRAINT product_candidates_dedupe_key_length_check
    CHECK (char_length(dedupe_key) BETWEEN 1 AND 400),
  CONSTRAINT product_candidates_payload_object_check
    CHECK (jsonb_typeof(raw_payload_json) = 'object'),
  CONSTRAINT product_candidates_normalized_object_check
    CHECK (jsonb_typeof(normalized_json) = 'object'),
  CONSTRAINT product_candidates_title_length_check
    CHECK (char_length(title) BETWEEN 1 AND 500),
  CONSTRAINT product_candidates_price_pair_check
    CHECK ((price_amount IS NULL) = (price_currency IS NULL)),
  CONSTRAINT product_candidates_price_amount_check
    CHECK (price_amount IS NULL OR price_amount >= 0),
  CONSTRAINT product_candidates_price_currency_check
    CHECK (price_currency IS NULL OR price_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT product_candidates_price_timestamp_check
    CHECK (price_fetched_at IS NULL OR price_amount IS NOT NULL),
  CONSTRAINT product_candidates_freshness_check
    CHECK (fresh_until IS NULL OR (price_fetched_at IS NOT NULL AND fresh_until >= price_fetched_at)),
  CONSTRAINT product_candidates_product_url_check
    CHECK (product_url ~ '^https?://'),
  CONSTRAINT product_candidates_affiliate_url_check
    CHECK (affiliate_url IS NULL OR affiliate_url ~ '^https?://'),
  CONSTRAINT product_candidates_scores_check
    CHECK (
      confidence_score BETWEEN 0 AND 100
      AND fit_score BETWEEN 0 AND 100
    ),
  CONSTRAINT product_candidates_compliance_status_check
    CHECK (compliance_status IN ('safe', 'needs_review', 'blocked')),
  CONSTRAINT product_candidates_review_status_check
    CHECK (review_status IN ('pending', 'approved', 'rejected', 'needs_edit', 'stale')),
  CONSTRAINT product_candidates_review_metadata_check
    CHECK (
      (review_status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL)
      OR
      (review_status <> 'pending' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
    ),
  CONSTRAINT product_candidates_approval_link_check
    CHECK (review_status <> 'approved' OR promoted_laptop_id IS NOT NULL),
  CONSTRAINT product_candidates_notes_length_check
    CHECK (admin_notes IS NULL OR char_length(admin_notes) <= 4000),
  CONSTRAINT product_candidates_error_length_check
    CHECK (error_message IS NULL OR char_length(error_message) <= 2000),
  CONSTRAINT product_candidates_source_dedupe_unique
    UNIQUE (source_key, dedupe_key)
);

COMMENT ON TABLE public.product_candidates IS
  'Server-only normalized laptop discoveries awaiting explicit admin review; never public catalog content.';
COMMENT ON COLUMN public.product_candidates.raw_payload_json IS
  'Sanitized source payload only. Never store credentials, request headers, or disallowed marketplace content.';

CREATE UNIQUE INDEX IF NOT EXISTS product_candidates_source_product_unique_idx
  ON public.product_candidates (source_key, source_product_id)
  WHERE source_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_candidates_review_queue_idx
  ON public.product_candidates (review_status, compliance_status, fit_score DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS product_candidates_source_updated_idx
  ON public.product_candidates (source_key, updated_at DESC);
CREATE INDEX IF NOT EXISTS product_candidates_freshness_idx
  ON public.product_candidates (fresh_until)
  WHERE fresh_until IS NOT NULL AND review_status IN ('pending', 'approved');
CREATE INDEX IF NOT EXISTS product_candidates_promoted_laptop_idx
  ON public.product_candidates (promoted_laptop_id)
  WHERE promoted_laptop_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_candidates_fit_tags_idx
  ON public.product_candidates USING GIN (fit_tags);
CREATE INDEX IF NOT EXISTS product_candidates_risk_tags_idx
  ON public.product_candidates USING GIN (risk_tags);

DROP TRIGGER IF EXISTS product_candidates_updated_at ON public.product_candidates;
CREATE TRIGGER product_candidates_updated_at
  BEFORE UPDATE ON public.product_candidates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Multi-source product offers -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_offers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laptop_id           UUID REFERENCES public.laptops(id) ON DELETE RESTRICT,
  candidate_id        UUID REFERENCES public.product_candidates(id) ON DELETE RESTRICT,
  source_key          TEXT NOT NULL,
  source_product_id   TEXT,
  product_url         TEXT NOT NULL,
  affiliate_url       TEXT,
  price_amount        NUMERIC(12,2),
  price_currency      TEXT,
  price_fetched_at    TIMESTAMPTZ,
  availability        TEXT,
  source_fetched_at   TIMESTAMPTZ NOT NULL,
  fresh_until         TIMESTAMPTZ,
  compliance_status   TEXT NOT NULL DEFAULT 'needs_review',
  is_active            BOOLEAN NOT NULL DEFAULT true,
  raw_payload_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT product_offers_owner_check
    CHECK (laptop_id IS NOT NULL OR candidate_id IS NOT NULL),
  CONSTRAINT product_offers_source_key_check
    CHECK (source_key ~ '^[a-z][a-z0-9_-]{0,63}$'),
  CONSTRAINT product_offers_source_product_id_length_check
    CHECK (source_product_id IS NULL OR char_length(source_product_id) BETWEEN 1 AND 256),
  CONSTRAINT product_offers_product_url_check
    CHECK (product_url ~ '^https?://'),
  CONSTRAINT product_offers_affiliate_url_check
    CHECK (affiliate_url IS NULL OR affiliate_url ~ '^https?://'),
  CONSTRAINT product_offers_price_pair_check
    CHECK ((price_amount IS NULL) = (price_currency IS NULL)),
  CONSTRAINT product_offers_price_amount_check
    CHECK (price_amount IS NULL OR price_amount >= 0),
  CONSTRAINT product_offers_price_currency_check
    CHECK (price_currency IS NULL OR price_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT product_offers_price_timestamp_check
    CHECK (price_fetched_at IS NULL OR price_amount IS NOT NULL),
  CONSTRAINT product_offers_freshness_check
    CHECK (fresh_until IS NULL OR (price_fetched_at IS NOT NULL AND fresh_until >= price_fetched_at)),
  CONSTRAINT product_offers_compliance_status_check
    CHECK (compliance_status IN ('safe', 'needs_review', 'blocked')),
  CONSTRAINT product_offers_payload_object_check
    CHECK (jsonb_typeof(raw_payload_json) = 'object')
);

COMMENT ON TABLE public.product_offers IS
  'Source-neutral offers attached to an approved laptop and/or its reviewed candidate.';

CREATE UNIQUE INDEX IF NOT EXISTS product_offers_candidate_source_unique_idx
  ON public.product_offers (candidate_id, source_key)
  WHERE candidate_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS product_offers_laptop_source_product_unique_idx
  ON public.product_offers (laptop_id, source_key, source_product_id)
  WHERE laptop_id IS NOT NULL AND source_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_offers_laptop_active_idx
  ON public.product_offers (laptop_id, is_active, source_key)
  WHERE laptop_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_offers_freshness_idx
  ON public.product_offers (fresh_until)
  WHERE is_active AND fresh_until IS NOT NULL;

DROP TRIGGER IF EXISTS product_offers_updated_at ON public.product_offers;
CREATE TRIGGER product_offers_updated_at
  BEFORE UPDATE ON public.product_offers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Server-only boundary -------------------------------------------------------
ALTER TABLE public.product_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_offers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_candidates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_offers     FORCE ROW LEVEL SECURITY;

-- No anon/authenticated policies are intentionally created. All reads and
-- writes go through authenticated admin endpoints using the service role.
REVOKE ALL ON TABLE public.product_candidates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_offers     FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_candidates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_offers     TO service_role;
