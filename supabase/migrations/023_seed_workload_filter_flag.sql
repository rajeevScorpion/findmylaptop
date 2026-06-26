-- ============================================================================
-- 023 — Seed the workload-filter feature flag into public.settings
-- ----------------------------------------------------------------------------
-- Controls whether the guided finder shows the "Workload" chips. Hidden for now
-- (value 'false') while we rework how workload should actually influence ranking.
-- Idempotent: ON CONFLICT DO NOTHING preserves any value an admin already set.
-- Stored as TEXT 'true'/'false' to match the existing key/value settings shape.
-- Rollback: 023_seed_workload_filter_flag_rollback.sql
-- ============================================================================

INSERT INTO public.settings (key, value) VALUES
  ('workload_filter_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
