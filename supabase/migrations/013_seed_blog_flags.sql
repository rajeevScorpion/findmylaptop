-- ============================================================================
-- 013 — Seed blog/CMS feature flags into the existing public.settings table
-- ----------------------------------------------------------------------------
-- Idempotent: ON CONFLICT DO NOTHING preserves any value an admin already set.
-- Stored as TEXT 'true'/'false' to match the existing key/value settings shape.
-- Rollback: 013_seed_blog_flags_rollback.sql
-- ============================================================================

INSERT INTO public.settings (key, value) VALUES
  ('blog_enabled',                'true'),
  ('blog_public_enabled',         'false'),  -- keep public off until first content is reviewed
  ('ai_blog_writer_enabled',      'false'),  -- keep off until OpenAI key is confirmed
  ('blog_product_blocks_enabled', 'false'),
  ('blog_schema_enabled',         'true'),
  ('blog_auto_sitemap_enabled',   'true')
ON CONFLICT (key) DO NOTHING;
