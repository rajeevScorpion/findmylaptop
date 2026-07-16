-- Rollback for 027_add_blog_personas.sql.
-- Run only after disabling persona authoring. Existing post content is preserved;
-- persona attribution/research metadata added by 027 is removed.

DROP TRIGGER IF EXISTS blog_persona_prevent_unsafe_delete ON public.blog_author_personas;
DROP TRIGGER IF EXISTS blog_posts_audit_persona_assignment ON public.blog_posts;
DROP TRIGGER IF EXISTS blog_persona_capture_version ON public.blog_author_personas;
DROP TRIGGER IF EXISTS blog_persona_bump_version ON public.blog_author_personas;
DROP TRIGGER IF EXISTS blog_author_personas_updated_at ON public.blog_author_personas;

ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_persona_snapshot_check,
  DROP CONSTRAINT IF EXISTS blog_posts_persona_generated_check,
  DROP CONSTRAINT IF EXISTS blog_posts_author_type_check,
  DROP CONSTRAINT IF EXISTS blog_posts_author_persona_id_fkey;

DROP INDEX IF EXISTS public.blog_posts_author_persona_idx;

ALTER TABLE public.blog_posts
  DROP COLUMN IF EXISTS research_input_ids,
  DROP COLUMN IF EXISTS persona_generated,
  DROP COLUMN IF EXISTS persona_selection_reason,
  DROP COLUMN IF EXISTS author_type,
  DROP COLUMN IF EXISTS author_persona_snapshot_json,
  DROP COLUMN IF EXISTS author_persona_version,
  DROP COLUMN IF EXISTS author_persona_id;

DROP TABLE IF EXISTS public.blog_persona_audit_logs;
DROP TABLE IF EXISTS public.blog_persona_versions;
DROP TABLE IF EXISTS public.blog_author_personas;

DROP FUNCTION IF EXISTS public.prevent_blog_persona_delete_with_posts();
DROP FUNCTION IF EXISTS public.audit_blog_persona_assignment();
DROP FUNCTION IF EXISTS public.capture_blog_persona_version();
DROP FUNCTION IF EXISTS public.bump_blog_persona_version();
