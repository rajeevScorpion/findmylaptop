-- 031 rollback - restores the legacy browser-role policies and grants.
-- WARNING: this intentionally re-opens the access model that migration 031
-- closes. Use only after deploying code compatible with that legacy model.

DELETE FROM public.agent_settings
WHERE key = 'retention_chat_transcripts_days';

ALTER TABLE public.chat_sessions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_feedback NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.session_feedback DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_sessions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.session_feedback TO anon, authenticated;

ALTER TABLE public.blog_posts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.blog_categories NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.blog_tags NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_tags NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_logs NO FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_posts TO authenticated;
GRANT SELECT ON TABLE public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_categories TO authenticated;
GRANT SELECT ON TABLE public.blog_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_tags TO authenticated;
GRANT SELECT ON TABLE public.blog_tags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_post_tags TO authenticated;
GRANT SELECT ON TABLE public.blog_post_tags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_generation_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.settings TO authenticated;

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
DROP POLICY IF EXISTS "settings_authenticated_write" ON public.settings;

CREATE POLICY "blog_posts_public_read"
  ON public.blog_posts FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "blog_posts_authenticated_read"
  ON public.blog_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "blog_posts_authenticated_write"
  ON public.blog_posts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "blog_categories_public_read"
  ON public.blog_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "blog_categories_authenticated_write"
  ON public.blog_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "blog_tags_public_read"
  ON public.blog_tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "blog_tags_authenticated_write"
  ON public.blog_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "blog_post_tags_public_read"
  ON public.blog_post_tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "blog_post_tags_authenticated_write"
  ON public.blog_post_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ai_generation_logs_authenticated_read"
  ON public.ai_generation_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_generation_logs_authenticated_write"
  ON public.ai_generation_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "settings_authenticated_write"
  ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
