-- ============================================================================
-- 013 ROLLBACK — removes ONLY the 6 blog feature-flag keys seeded by 013.
-- Leaves all other settings (whatsapp_url, disclaimer_text, etc.) untouched.
-- ============================================================================

DELETE FROM public.settings WHERE key IN (
  'blog_enabled',
  'blog_public_enabled',
  'ai_blog_writer_enabled',
  'blog_product_blocks_enabled',
  'blog_schema_enabled',
  'blog_auto_sitemap_enabled'
);
