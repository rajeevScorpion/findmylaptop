-- ============================================================================
-- 015 — Persist the AI-panel inputs on each post (ADDITIVE, nullable)
-- ----------------------------------------------------------------------------
-- Stores { topic, brief, sourceText, targetLength, audience, template } so the
-- admin's AI inputs survive save + reload. Nullable column added to the
-- existing public.blog_posts table — no data is modified.
-- Rollback: 015_add_ai_inputs_rollback.sql
-- ============================================================================

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS ai_inputs JSONB;
