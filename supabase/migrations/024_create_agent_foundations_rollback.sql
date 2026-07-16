-- ============================================================================
-- 024 ROLLBACK - removes ONLY autonomous growth-agent foundation tables
-- ----------------------------------------------------------------------------
-- Run this only after all later growth-agent migrations have been rolled back.
-- Existing laptops, settings, blog, chat, course, and visit data are untouched.
-- Children are dropped before parents.
-- ============================================================================

DROP TABLE IF EXISTS public.admin_notifications CASCADE;
DROP TABLE IF EXISTS public.audit_events         CASCADE;
DROP TABLE IF EXISTS public.source_adapters      CASCADE;
DROP TABLE IF EXISTS public.agent_jobs           CASCADE;
DROP TABLE IF EXISTS public.agent_settings       CASCADE;
