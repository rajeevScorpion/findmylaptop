-- ============================================================================
-- 011 — AI SEO Blog/CMS content model (ADDITIVE ONLY)
-- ----------------------------------------------------------------------------
-- Creates new tables for the blog/CMS feature. Does NOT touch laptops, settings,
-- courses, chat_sessions, session_feedback, or visit_counter.
-- Safe to run on production: every statement is IF NOT EXISTS / additive.
-- Reuses the existing public.handle_updated_at() trigger function (from 002).
-- Rollback: 011_create_blog_rollback.sql
-- ============================================================================

-- Categories ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blog_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tags ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blog_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Posts ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  slug                  TEXT NOT NULL UNIQUE,
  excerpt               TEXT,
  content_json          JSONB,                       -- source of truth: { type:"doc", blocks:[...] }
  content_html          TEXT,                        -- optional rendered cache
  toc_json              JSONB,                       -- [{ id, text, level }]
  schema_json           JSONB,                       -- optional cached JSON-LD source
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','ai_generated','review','published','archived')),
  template_type         TEXT,
  audience              TEXT[] DEFAULT '{}',
  primary_keyword       TEXT,
  secondary_keywords    TEXT[] DEFAULT '{}',
  meta_title            TEXT,
  meta_description      TEXT,
  canonical_url         TEXT,
  og_title              TEXT,
  og_description        TEXT,
  og_image_url          TEXT,
  reading_time_minutes  INTEGER,
  category_id           UUID REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  created_by            TEXT,
  updated_by            TEXT,
  published_at          TIMESTAMPTZ,
  last_reviewed_at      TIMESTAMPTZ,
  needs_update_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blog_posts_slug_idx   ON public.blog_posts (slug);
CREATE INDEX IF NOT EXISTS blog_posts_status_idx ON public.blog_posts (status, published_at DESC);

-- updated_at trigger reusing the existing shared function from migration 002
DROP TRIGGER IF EXISTS blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS blog_categories_updated_at ON public.blog_categories;
CREATE TRIGGER blog_categories_updated_at
  BEFORE UPDATE ON public.blog_categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS blog_tags_updated_at ON public.blog_tags;
CREATE TRIGGER blog_tags_updated_at
  BEFORE UPDATE ON public.blog_tags
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Post <-> Tag join ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blog_post_tags (
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES public.blog_tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- AI generation logs (metadata only — NEVER store keys/secrets/raw output) ---
CREATE TABLE IF NOT EXISTS public.ai_generation_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID REFERENCES public.blog_posts(id) ON DELETE SET NULL,
  generation_type TEXT,                              -- outline | draft | metadata | faqs | section
  model           TEXT,
  prompt_version  TEXT,
  input_topic     TEXT,
  input_brief     TEXT,
  input_keywords  TEXT[] DEFAULT '{}',
  output_status   TEXT,                              -- success | invalid | error
  error_message   TEXT,
  tokens_input    INTEGER,
  tokens_output   INTEGER,
  tokens_cached   INTEGER,
  cost_estimate   NUMERIC(10,5),
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_generation_logs_post_idx
  ON public.ai_generation_logs (post_id, created_at DESC);
