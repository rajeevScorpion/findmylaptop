-- ============================================================================
-- 031 - Restrict legacy chat transcripts and CMS tables to trusted server code
-- ----------------------------------------------------------------------------
-- Existing migrations relied on application conventions while leaving broad
-- Data API access in place. Public pages and admin APIs now use narrow,
-- authenticated server-side projections, so browser roles need no table access.
-- Requires: 024_create_agent_foundations.sql
-- Rollback: 031_harden_chat_and_blog_access_rollback.sql
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.chat_sessions') IS NULL
     OR to_regclass('public.session_feedback') IS NULL
     OR to_regclass('public.blog_posts') IS NULL THEN
    RAISE EXCEPTION 'Required legacy chat/blog tables are missing';
  END IF;
END;
$$;

-- Full chat text and feedback are service-role only. No browser policy exists.
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.session_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_feedback FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.chat_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.session_feedback FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.session_feedback TO service_role;

-- Remove policies that treated every authenticated Supabase account as a CMS
-- administrator and that exposed every published-post column through REST.
DROP POLICY IF EXISTS "blog_posts_public_read" ON public.blog_posts;
DROP POLICY IF EXISTS "blog_posts_authenticated_read" ON public.blog_posts;
DROP POLICY IF EXISTS "blog_posts_authenticated_write" ON public.blog_posts;
DROP POLICY IF EXISTS "blog_categories_public_read" ON public.blog_categories;
DROP POLICY IF EXISTS "blog_categories_authenticated_write" ON public.blog_categories;
DROP POLICY IF EXISTS "blog_tags_public_read" ON public.blog_tags;
DROP POLICY IF EXISTS "blog_tags_authenticated_write" ON public.blog_tags;
DROP POLICY IF EXISTS "blog_post_tags_public_read" ON public.blog_post_tags;
DROP POLICY IF EXISTS "blog_post_tags_authenticated_write" ON public.blog_post_tags;
DROP POLICY IF EXISTS "ai_generation_logs_authenticated_read" ON public.ai_generation_logs;
DROP POLICY IF EXISTS "ai_generation_logs_authenticated_write" ON public.ai_generation_logs;

ALTER TABLE public.blog_posts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.blog_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.blog_tags FORCE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_tags FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_logs FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.blog_posts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.blog_categories FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.blog_tags FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.blog_post_tags FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_generation_logs FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_posts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_tags TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_post_tags TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_generation_logs TO service_role;

-- Public settings remain readable for the existing site, but browser roles can
-- no longer toggle feature/domain/admin values. Allowlisted server APIs write.
DROP POLICY IF EXISTS "settings_authenticated_write" ON public.settings;
REVOKE ALL ON TABLE public.settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.settings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.settings TO service_role;

-- This setting is introduced here so deployments upgrading from the legacy
-- transcript schema opt into an explicit retention value before deletion runs.
INSERT INTO public.agent_settings (key, value_json, description)
VALUES (
  'retention_chat_transcripts_days',
  '90'::jsonb,
  'Delete full legacy chat transcripts and their feedback after this many days.'
)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.chat_sessions IS
  'Service-only anonymous chat sessions. May contain full transcript text; governed by explicit retention.';
COMMENT ON TABLE public.session_feedback IS
  'Service-only rating/comment records linked to chat sessions; browser-supplied transcripts are not accepted.';
