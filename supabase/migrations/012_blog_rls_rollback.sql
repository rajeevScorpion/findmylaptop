-- ============================================================================
-- 012 ROLLBACK — drops ONLY the blog RLS policies created by 012_blog_rls.sql
-- ----------------------------------------------------------------------------
-- Leaves RLS enabled state harmless (tables are dropped by 011 rollback if a
-- full teardown is desired). Run this before 011 rollback for a clean reverse.
-- ============================================================================

DROP POLICY IF EXISTS "blog_posts_public_read"                ON public.blog_posts;
DROP POLICY IF EXISTS "blog_posts_authenticated_read"         ON public.blog_posts;
DROP POLICY IF EXISTS "blog_posts_authenticated_write"        ON public.blog_posts;

DROP POLICY IF EXISTS "blog_categories_public_read"           ON public.blog_categories;
DROP POLICY IF EXISTS "blog_categories_authenticated_write"   ON public.blog_categories;

DROP POLICY IF EXISTS "blog_tags_public_read"                 ON public.blog_tags;
DROP POLICY IF EXISTS "blog_tags_authenticated_write"         ON public.blog_tags;

DROP POLICY IF EXISTS "blog_post_tags_public_read"            ON public.blog_post_tags;
DROP POLICY IF EXISTS "blog_post_tags_authenticated_write"    ON public.blog_post_tags;

DROP POLICY IF EXISTS "ai_generation_logs_authenticated_read"  ON public.ai_generation_logs;
DROP POLICY IF EXISTS "ai_generation_logs_authenticated_write" ON public.ai_generation_logs;
