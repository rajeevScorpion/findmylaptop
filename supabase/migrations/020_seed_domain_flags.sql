-- ============================================================================
-- 020 — Seed the Technology & Management domain feature flags
-- ----------------------------------------------------------------------------
-- Gates the /technology and /management tabs/routes. Default OFF so the Design
-- experience ships unchanged; an admin flips these on once each domain's
-- catalog and content are ready. Idempotent: ON CONFLICT DO NOTHING preserves
-- any value an admin already set. Rollback: 020_seed_domain_flags_rollback.sql
-- ============================================================================

INSERT INTO public.settings (key, value) VALUES
  ('domain_tech_enabled', 'false'),
  ('domain_mgmt_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
