-- ============================================================================
-- 028 - Privacy-minimized Chip learning (ADDITIVE ONLY)
-- ----------------------------------------------------------------------------
-- Stores bounded, structured recommendation signals and anonymous preference
-- profiles. It deliberately stores no chat text/transcript, names, email/IP,
-- user agent, raw session id, or other identity data. Session linkage uses a
-- one-way SHA-256 digest of the random chat session id.
--
-- Requires: 024_create_agent_foundations.sql
-- Rollback: 028_create_chip_learning_rollback.sql
-- ============================================================================

-- Anonymous structured preference profile -----------------------------------
CREATE TABLE IF NOT EXISTS public.chip_session_profiles (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_session_hash     TEXT NOT NULL UNIQUE,
  domain                     TEXT NOT NULL,
  budget_min                 INTEGER,
  budget_max                 INTEGER,
  role_tags                  TEXT[] NOT NULL DEFAULT '{}',
  course_tags                TEXT[] NOT NULL DEFAULT '{}',
  software_tags              TEXT[] NOT NULL DEFAULT '{}',
  brand_preferences          TEXT[] NOT NULL DEFAULT '{}',
  priority_tags              TEXT[] NOT NULL DEFAULT '{}',
  intent_tags                TEXT[] NOT NULL DEFAULT '{}',
  confidence                 NUMERIC(4,3) NOT NULL DEFAULT 0,
  signals_count              INTEGER NOT NULL DEFAULT 0,
  last_seen_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at                 TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days'),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chip_session_profiles_hash_check
    CHECK (anonymous_session_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT chip_session_profiles_domain_check
    CHECK (domain IN ('design', 'technology', 'management')),
  CONSTRAINT chip_session_profiles_budget_check
    CHECK (
      (budget_min IS NULL OR budget_min BETWEEN 5000 AND 10000000)
      AND (budget_max IS NULL OR budget_max BETWEEN 5000 AND 10000000)
      AND (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max)
    ),
  CONSTRAINT chip_session_profiles_confidence_check
    CHECK (confidence BETWEEN 0 AND 1),
  CONSTRAINT chip_session_profiles_signals_count_check
    CHECK (signals_count BETWEEN 0 AND 1000),
  CONSTRAINT chip_session_profiles_tag_limits_check
    CHECK (
      cardinality(role_tags) <= 8
      AND cardinality(course_tags) <= 20
      AND cardinality(software_tags) <= 20
      AND cardinality(brand_preferences) <= 20
      AND cardinality(priority_tags) <= 20
      AND cardinality(intent_tags) <= 20
    ),
  CONSTRAINT chip_session_profiles_tag_format_check
    CHECK (
      array_to_string(role_tags, ',') ~ '^(|[a-z0-9][a-z0-9:-]{0,63}(,[a-z0-9][a-z0-9:-]{0,63})*)$'
      AND array_to_string(course_tags, ',') ~ '^(|[a-z0-9][a-z0-9:-]{0,63}(,[a-z0-9][a-z0-9:-]{0,63})*)$'
      AND array_to_string(software_tags, ',') ~ '^(|[a-z0-9][a-z0-9:-]{0,63}(,[a-z0-9][a-z0-9:-]{0,63})*)$'
      AND array_to_string(brand_preferences, ',') ~ '^(|[a-z0-9][a-z0-9:-]{0,63}(,[a-z0-9][a-z0-9:-]{0,63})*)$'
      AND array_to_string(priority_tags, ',') ~ '^(|[a-z0-9][a-z0-9:-]{0,63}(,[a-z0-9][a-z0-9:-]{0,63})*)$'
      AND array_to_string(intent_tags, ',') ~ '^(|[a-z0-9][a-z0-9:-]{0,63}(,[a-z0-9][a-z0-9:-]{0,63})*)$'
    ),
  CONSTRAINT chip_session_profiles_expiry_check
    CHECK (expires_at > created_at)
);

COMMENT ON TABLE public.chip_session_profiles IS
  'Server-only anonymous structured Chip preferences. No raw session id, transcript, free text, or PII.';
COMMENT ON COLUMN public.chip_session_profiles.anonymous_session_hash IS
  'One-way digest of a random chat session id; never store the raw id in this table.';

CREATE INDEX IF NOT EXISTS chip_session_profiles_expiry_idx
  ON public.chip_session_profiles (expires_at);
CREATE INDEX IF NOT EXISTS chip_session_profiles_domain_updated_idx
  ON public.chip_session_profiles (domain, updated_at DESC);

DROP TRIGGER IF EXISTS chip_session_profiles_updated_at
  ON public.chip_session_profiles;
CREATE TRIGGER chip_session_profiles_updated_at
  BEFORE UPDATE ON public.chip_session_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Immutable, structured interaction events ----------------------------------
CREATE TABLE IF NOT EXISTS public.chip_interaction_events (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_session_hash     TEXT NOT NULL,
  turn_number                INTEGER NOT NULL,
  event_type                 TEXT NOT NULL,
  domain                     TEXT NOT NULL,
  budget_min                 INTEGER,
  budget_max                 INTEGER,
  role_tags                  TEXT[] NOT NULL DEFAULT '{}',
  course_tags                TEXT[] NOT NULL DEFAULT '{}',
  software_tags              TEXT[] NOT NULL DEFAULT '{}',
  brand_preferences          TEXT[] NOT NULL DEFAULT '{}',
  priority_tags              TEXT[] NOT NULL DEFAULT '{}',
  intent_tags                TEXT[] NOT NULL DEFAULT '{}',
  recommended_slugs          TEXT[] NOT NULL DEFAULT '{}',
  confidence                 NUMERIC(4,3) NOT NULL DEFAULT 0,
  expires_at                 TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days'),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chip_interaction_events_dedupe
    UNIQUE (anonymous_session_hash, turn_number, event_type),
  CONSTRAINT chip_interaction_events_hash_check
    CHECK (anonymous_session_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT chip_interaction_events_turn_check
    CHECK (turn_number BETWEEN 1 AND 1000),
  CONSTRAINT chip_interaction_events_type_check
    CHECK (event_type IN ('preference_signal', 'recommendation', 'feedback', 'product_click', 'reject', 'save')),
  CONSTRAINT chip_interaction_events_domain_check
    CHECK (domain IN ('design', 'technology', 'management')),
  CONSTRAINT chip_interaction_events_budget_check
    CHECK (
      (budget_min IS NULL OR budget_min BETWEEN 5000 AND 10000000)
      AND (budget_max IS NULL OR budget_max BETWEEN 5000 AND 10000000)
      AND (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max)
    ),
  CONSTRAINT chip_interaction_events_confidence_check
    CHECK (confidence BETWEEN 0 AND 1),
  CONSTRAINT chip_interaction_events_tag_limits_check
    CHECK (
      cardinality(role_tags) <= 8
      AND cardinality(course_tags) <= 20
      AND cardinality(software_tags) <= 20
      AND cardinality(brand_preferences) <= 20
      AND cardinality(priority_tags) <= 20
      AND cardinality(intent_tags) <= 20
      AND cardinality(recommended_slugs) <= 3
    ),
  CONSTRAINT chip_interaction_events_tag_format_check
    CHECK (
      array_to_string(role_tags, ',') ~ '^(|[a-z0-9][a-z0-9:-]{0,63}(,[a-z0-9][a-z0-9:-]{0,63})*)$'
      AND array_to_string(course_tags, ',') ~ '^(|[a-z0-9][a-z0-9:-]{0,63}(,[a-z0-9][a-z0-9:-]{0,63})*)$'
      AND array_to_string(software_tags, ',') ~ '^(|[a-z0-9][a-z0-9:-]{0,63}(,[a-z0-9][a-z0-9:-]{0,63})*)$'
      AND array_to_string(brand_preferences, ',') ~ '^(|[a-z0-9][a-z0-9:-]{0,63}(,[a-z0-9][a-z0-9:-]{0,63})*)$'
      AND array_to_string(priority_tags, ',') ~ '^(|[a-z0-9][a-z0-9:-]{0,63}(,[a-z0-9][a-z0-9:-]{0,63})*)$'
      AND array_to_string(intent_tags, ',') ~ '^(|[a-z0-9][a-z0-9:-]{0,63}(,[a-z0-9][a-z0-9:-]{0,63})*)$'
      AND array_to_string(recommended_slugs, ',') ~ '^(|[a-z0-9][a-z0-9-]{0,199}(,[a-z0-9][a-z0-9-]{0,199})*)$'
    ),
  CONSTRAINT chip_interaction_events_expiry_check
    CHECK (expires_at > created_at)
);

COMMENT ON TABLE public.chip_interaction_events IS
  'Server-only structured Chip signals. Never store messages, transcript excerpts, free-text summaries, or PII.';

CREATE INDEX IF NOT EXISTS chip_interaction_events_session_created_idx
  ON public.chip_interaction_events (anonymous_session_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS chip_interaction_events_type_created_idx
  ON public.chip_interaction_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS chip_interaction_events_expiry_idx
  ON public.chip_interaction_events (expires_at);

-- Restrictive server-only access --------------------------------------------
ALTER TABLE public.chip_session_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chip_interaction_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.chip_session_profiles   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.chip_interaction_events FORCE ROW LEVEL SECURITY;

-- No anon/authenticated policies are intentionally created.
REVOKE ALL ON TABLE public.chip_session_profiles
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.chip_interaction_events
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chip_session_profiles
  TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.chip_interaction_events
  TO service_role;
