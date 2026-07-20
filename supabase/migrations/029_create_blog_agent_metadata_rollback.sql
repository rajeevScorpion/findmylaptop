-- 029 rollback - remove Blogging Agent metadata after disabling draft runs.
-- Generated blog_posts are intentionally preserved as ordinary CMS drafts.

DROP FUNCTION IF EXISTS public.persist_blog_agent_post(
  UUID, UUID, UUID, UUID, JSONB, NUMERIC, JSONB, JSONB, JSONB, TEXT, TEXT
);
DROP TABLE IF EXISTS public.blog_agent_drafts;
