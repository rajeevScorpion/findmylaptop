-- ============================================================================
-- 024 - Autonomous growth-agent foundations (ADDITIVE ONLY)
-- ----------------------------------------------------------------------------
-- Restricted, server-only configuration, durable jobs, source health metadata,
-- admin notifications, and audit events. These tables intentionally have no
-- anon/authenticated policies and must only be accessed by trusted server code
-- using the service-role client. Never store credentials or secrets here.
-- Rollback: 024_create_agent_foundations_rollback.sql
-- ============================================================================

-- Agent settings -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  value_json  JSONB NOT NULL,
  description TEXT,
  updated_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_settings_key_format_check
    CHECK (key ~ '^[a-z][a-z0-9_]{1,79}$'),
  CONSTRAINT agent_settings_no_secret_keys_check
    CHECK (key !~ '(secret|token|password|credential|api_?key|access_?key)'),
  CONSTRAINT agent_settings_text_length_check
    CHECK (
      (description IS NULL OR char_length(description) <= 1000)
      AND (updated_by IS NULL OR char_length(updated_by) <= 320)
    )
);

COMMENT ON TABLE public.agent_settings IS
  'Server-only non-secret growth-agent configuration. Never store credentials, tokens, or API keys.';
COMMENT ON COLUMN public.agent_settings.value_json IS
  'Non-secret JSON configuration only. Credentials belong in server environment variables.';

CREATE INDEX IF NOT EXISTS agent_settings_updated_at_idx
  ON public.agent_settings (updated_at DESC);

DROP TRIGGER IF EXISTS agent_settings_updated_at ON public.agent_settings;
CREATE TRIGGER agent_settings_updated_at
  BEFORE UPDATE ON public.agent_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Durable jobs ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type          TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'queued',
  idempotency_key   TEXT NOT NULL UNIQUE,
  payload_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_json       JSONB,
  error_code        TEXT,
  error_message     TEXT,
  attempt_count     INTEGER NOT NULL DEFAULT 0,
  max_attempts      INTEGER NOT NULL DEFAULT 3,
  scheduled_for     TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_retry_at     TIMESTAMPTZ,
  lock_owner        TEXT,
  lock_token        UUID,
  locked_at         TIMESTAMPTZ,
  lock_expires_at   TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_jobs_type_format_check
    CHECK (
      char_length(job_type) <= 160
      AND job_type ~ '^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$'
    ),
  CONSTRAINT agent_jobs_status_check
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  CONSTRAINT agent_jobs_idempotency_key_check
    CHECK (char_length(idempotency_key) BETWEEN 1 AND 255),
  CONSTRAINT agent_jobs_payload_object_check
    CHECK (jsonb_typeof(payload_json) = 'object'),
  CONSTRAINT agent_jobs_attempts_check
    CHECK (
      attempt_count >= 0
      AND max_attempts BETWEEN 1 AND 25
      AND attempt_count <= max_attempts
    ),
  CONSTRAINT agent_jobs_error_length_check
    CHECK (
      (error_code IS NULL OR char_length(error_code) <= 120)
      AND (error_message IS NULL OR char_length(error_message) <= 2000)
    ),
  CONSTRAINT agent_jobs_actor_length_check
    CHECK (
      (lock_owner IS NULL OR char_length(lock_owner) BETWEEN 1 AND 200)
      AND (created_by IS NULL OR char_length(created_by) <= 320)
    ),
  CONSTRAINT agent_jobs_retry_state_check
    CHECK (next_retry_at IS NULL OR status IN ('queued', 'failed')),
  CONSTRAINT agent_jobs_lock_fields_check
    CHECK (
      (lock_owner IS NULL AND lock_token IS NULL AND locked_at IS NULL AND lock_expires_at IS NULL)
      OR
      (lock_owner IS NOT NULL AND lock_token IS NOT NULL AND locked_at IS NOT NULL
        AND lock_expires_at IS NOT NULL AND lock_expires_at > locked_at)
    ),
  CONSTRAINT agent_jobs_finished_state_check
    CHECK (
      (status IN ('succeeded', 'failed', 'cancelled') AND finished_at IS NOT NULL)
      OR
      (status IN ('queued', 'running') AND finished_at IS NULL)
    )
);

COMMENT ON TABLE public.agent_jobs IS
  'Server-only durable growth-agent job state. Payloads and errors must be scrubbed of secrets and sensitive raw data.';

CREATE INDEX IF NOT EXISTS agent_jobs_dispatch_idx
  ON public.agent_jobs (status, scheduled_for, created_at)
  WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS agent_jobs_type_status_idx
  ON public.agent_jobs (job_type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_jobs_retry_idx
  ON public.agent_jobs (next_retry_at)
  WHERE next_retry_at IS NOT NULL AND status IN ('queued', 'failed');
CREATE INDEX IF NOT EXISTS agent_jobs_lock_expiry_idx
  ON public.agent_jobs (lock_expires_at)
  WHERE lock_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS agent_jobs_created_at_idx
  ON public.agent_jobs (created_at DESC);

DROP TRIGGER IF EXISTS agent_jobs_updated_at ON public.agent_jobs;
CREATE TRIGGER agent_jobs_updated_at
  BEFORE UPDATE ON public.agent_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Source adapter registry ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.source_adapters (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key               TEXT NOT NULL UNIQUE,
  display_name             TEXT NOT NULL,
  mode                     TEXT NOT NULL,
  enabled                  BOOLEAN NOT NULL DEFAULT false,
  credential_status        TEXT NOT NULL DEFAULT 'not_required',
  freshness_ttl_minutes    INTEGER NOT NULL DEFAULT 1440,
  public_display_allowed   BOOLEAN NOT NULL DEFAULT false,
  requires_admin_approval  BOOLEAN NOT NULL DEFAULT true,
  last_health_check_at     TIMESTAMPTZ,
  last_success_at          TIMESTAMPTZ,
  last_error_at            TIMESTAMPTZ,
  last_error_message       TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT source_adapters_key_format_check
    CHECK (source_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  CONSTRAINT source_adapters_display_name_check
    CHECK (char_length(display_name) BETWEEN 1 AND 120),
  CONSTRAINT source_adapters_mode_check
    CHECK (mode IN ('api', 'manual', 'csv', 'feed')),
  CONSTRAINT source_adapters_credential_status_check
    CHECK (credential_status IN ('not_required', 'not_configured', 'unchecked', 'valid', 'invalid', 'error')),
  CONSTRAINT source_adapters_freshness_check
    CHECK (freshness_ttl_minutes BETWEEN 5 AND 10080),
  CONSTRAINT source_adapters_error_length_check
    CHECK (last_error_message IS NULL OR char_length(last_error_message) <= 2000)
);

COMMENT ON TABLE public.source_adapters IS
  'Server-only source enablement and health metadata. Stores credential status only, never credential values.';
COMMENT ON COLUMN public.source_adapters.credential_status IS
  'Status marker only. Source credentials must remain in server environment variables.';

CREATE INDEX IF NOT EXISTS source_adapters_enabled_idx
  ON public.source_adapters (enabled, source_key);
CREATE INDEX IF NOT EXISTS source_adapters_health_idx
  ON public.source_adapters (last_health_check_at, last_error_at);

DROP TRIGGER IF EXISTS source_adapters_updated_at ON public.source_adapters;
CREATE TRIGGER source_adapters_updated_at
  BEFORE UPDATE ON public.source_adapters
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Admin notifications --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_job_id   UUID REFERENCES public.agent_jobs(id) ON DELETE SET NULL,
  severity       TEXT NOT NULL DEFAULT 'info',
  category       TEXT NOT NULL,
  title          TEXT NOT NULL,
  message        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'unread',
  metadata_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at        TIMESTAMPTZ,
  read_by        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_notifications_severity_check
    CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  CONSTRAINT admin_notifications_status_check
    CHECK (status IN ('unread', 'read', 'dismissed')),
  CONSTRAINT admin_notifications_category_format_check
    CHECK (category ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  CONSTRAINT admin_notifications_content_length_check
    CHECK (char_length(title) BETWEEN 1 AND 200 AND char_length(message) BETWEEN 1 AND 4000),
  CONSTRAINT admin_notifications_metadata_object_check
    CHECK (jsonb_typeof(metadata_json) = 'object'),
  CONSTRAINT admin_notifications_read_state_check
    CHECK (
      (status = 'unread' AND read_at IS NULL AND read_by IS NULL)
      OR
      (status IN ('read', 'dismissed'))
    )
);

COMMENT ON TABLE public.admin_notifications IS
  'Server-only operational notifications. Metadata must not include credentials, secrets, or raw private user content.';

CREATE INDEX IF NOT EXISTS admin_notifications_inbox_idx
  ON public.admin_notifications (status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_notifications_job_idx
  ON public.admin_notifications (agent_job_id, created_at DESC)
  WHERE agent_job_id IS NOT NULL;

DROP TRIGGER IF EXISTS admin_notifications_updated_at ON public.admin_notifications;
CREATE TRIGGER admin_notifications_updated_at
  BEFORE UPDATE ON public.admin_notifications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Immutable audit stream -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type        TEXT NOT NULL,
  actor_type        TEXT NOT NULL,
  actor_identifier  TEXT,
  entity_type       TEXT,
  entity_id         TEXT,
  summary           TEXT,
  metadata_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audit_events_event_type_format_check
    CHECK (event_type ~ '^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$'),
  CONSTRAINT audit_events_actor_type_check
    CHECK (actor_type IN ('admin', 'cron', 'system', 'agent')),
  CONSTRAINT audit_events_entity_pair_check
    CHECK ((entity_type IS NULL) = (entity_id IS NULL)),
  CONSTRAINT audit_events_metadata_object_check
    CHECK (jsonb_typeof(metadata_json) = 'object'),
  CONSTRAINT audit_events_summary_length_check
    CHECK (summary IS NULL OR char_length(summary) <= 1000),
  CONSTRAINT audit_events_text_length_check
    CHECK (
      char_length(event_type) <= 160
      AND (actor_identifier IS NULL OR char_length(actor_identifier) <= 320)
      AND (entity_type IS NULL OR char_length(entity_type) <= 120)
      AND (entity_id IS NULL OR char_length(entity_id) <= 500)
    )
);

COMMENT ON TABLE public.audit_events IS
  'Append-only server audit metadata. Never include secrets or raw private user content.';

CREATE INDEX IF NOT EXISTS audit_events_type_created_idx
  ON public.audit_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_entity_created_idx
  ON public.audit_events (entity_type, entity_id, created_at DESC)
  WHERE entity_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_events_created_at_idx
  ON public.audit_events (created_at DESC);

-- Fail-closed seeds ----------------------------------------------------------
-- ON CONFLICT DO NOTHING preserves explicit admin choices on safe re-runs.
INSERT INTO public.agent_settings (key, value_json, description) VALUES
  ('global_pause',                              'false'::jsonb, 'Pause scheduled growth-agent work.'),
  ('emergency_stop',                            'false'::jsonb, 'Emergency kill switch for all growth-agent work.'),
  ('research_agent_enabled',                    'false'::jsonb, 'Enable Research Agent execution.'),
  ('blogging_agent_enabled',                    'false'::jsonb, 'Enable Blogging Agent execution.'),
  ('chip_learning_enabled',                     'false'::jsonb, 'Enable structured Chip learning.'),
  ('affiliate_links_enabled',                   'false'::jsonb, 'Enable new centralized affiliate-link resolution.'),
  ('safe_mode',                                 'true'::jsonb,  'Keep generated work in draft/review-only mode.'),
  ('retention_raw_product_payloads_days',       '30'::jsonb,    'Retention for raw product candidate payloads.'),
  ('retention_chip_interaction_events_days',    '90'::jsonb,    'Retention for pseudonymous Chip interaction events.'),
  ('retention_anonymous_session_profiles_days', '90'::jsonb,    'Retention for anonymous preference summaries.'),
  ('retention_agent_jobs_days',                 '365'::jsonb,   'Retention for completed agent job records.'),
  ('retention_affiliate_click_events_days',     '365'::jsonb,   'Retention for affiliate click events.'),
  ('retention_audit_events_days',               '365'::jsonb,   'Retention for operational audit events.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.source_adapters (
  source_key,
  display_name,
  mode,
  enabled,
  credential_status,
  public_display_allowed,
  requires_admin_approval
) VALUES
  ('manual',   'Manual import', 'manual', true,  'not_required',   false, true),
  ('amazon',   'Amazon India',  'api',    false, 'not_configured', false, true),
  ('flipkart', 'Flipkart',      'api',    false, 'not_configured', false, true)
ON CONFLICT (source_key) DO NOTHING;

-- Server-only boundary -------------------------------------------------------
ALTER TABLE public.agent_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_jobs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_adapters       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events           ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agent_settings       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agent_jobs           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.source_adapters       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events           FORCE ROW LEVEL SECURITY;

-- No anon/authenticated policies are intentionally created. The service-role
-- client bypasses RLS; browser/session clients receive neither grants nor rows.
REVOKE ALL ON TABLE public.agent_settings       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.agent_jobs           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.source_adapters       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.admin_notifications   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.audit_events           FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_settings
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_jobs
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.source_adapters
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_notifications
  TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.audit_events
  TO service_role;
