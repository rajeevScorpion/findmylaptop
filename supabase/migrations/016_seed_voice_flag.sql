-- ============================================================================
-- 016 — Seed the chat voice-input feature flag into public.settings
-- ----------------------------------------------------------------------------
-- Controls whether the Chip chat widget shows the mic / voice-input button.
-- Idempotent: ON CONFLICT DO NOTHING preserves any value an admin already set.
-- Stored as TEXT 'true'/'false' to match the existing key/value settings shape.
-- Rollback: 016_seed_voice_flag_rollback.sql
-- ============================================================================

INSERT INTO public.settings (key, value) VALUES
  ('voice_input_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
