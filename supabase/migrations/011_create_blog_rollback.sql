-- ============================================================================
-- 011 ROLLBACK — removes ONLY the blog/CMS tables created by 011_create_blog.sql
-- ----------------------------------------------------------------------------
-- Does NOT drop public.handle_updated_at() — that function is shared with the
-- pre-existing laptops table and must remain. Children dropped before parents.
-- ============================================================================

DROP TABLE IF EXISTS public.ai_generation_logs CASCADE;
DROP TABLE IF EXISTS public.blog_post_tags     CASCADE;
DROP TABLE IF EXISTS public.blog_posts         CASCADE;
DROP TABLE IF EXISTS public.blog_tags          CASCADE;
DROP TABLE IF EXISTS public.blog_categories    CASCADE;
