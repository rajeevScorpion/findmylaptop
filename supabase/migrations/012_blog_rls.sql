-- ============================================================================
-- 012 — Row-Level Security for blog/CMS tables (mirrors 005_rls_policies.sql)
-- ----------------------------------------------------------------------------
-- anon may read ONLY published posts. authenticated may read all (admin drafts).
-- Admin-email enforcement happens in the application layer, as with laptops.
-- Rollback: 012_blog_rls_rollback.sql
-- ============================================================================

ALTER TABLE public.blog_posts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_tags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_tags    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;

-- POSTS ---------------------------------------------------------------------
CREATE POLICY "blog_posts_public_read"
  ON public.blog_posts FOR SELECT
  TO anon
  USING (status = 'published');

CREATE POLICY "blog_posts_authenticated_read"
  ON public.blog_posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "blog_posts_authenticated_write"
  ON public.blog_posts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- CATEGORIES ----------------------------------------------------------------
CREATE POLICY "blog_categories_public_read"
  ON public.blog_categories FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "blog_categories_authenticated_write"
  ON public.blog_categories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- TAGS ----------------------------------------------------------------------
CREATE POLICY "blog_tags_public_read"
  ON public.blog_tags FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "blog_tags_authenticated_write"
  ON public.blog_tags FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- POST <-> TAG JOIN ---------------------------------------------------------
CREATE POLICY "blog_post_tags_public_read"
  ON public.blog_post_tags FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "blog_post_tags_authenticated_write"
  ON public.blog_post_tags FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- AI LOGS — authenticated only, no anon access -----------------------------
CREATE POLICY "ai_generation_logs_authenticated_read"
  ON public.ai_generation_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ai_generation_logs_authenticated_write"
  ON public.ai_generation_logs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
