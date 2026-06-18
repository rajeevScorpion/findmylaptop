-- ============================================================================
-- 015 ROLLBACK — drops ONLY the ai_inputs column added by 015.
-- ============================================================================

ALTER TABLE public.blog_posts
  DROP COLUMN IF EXISTS ai_inputs;
