-- ============================================================================
-- 014 — Seed a recommended set of blog categories (ADDITIVE)
-- ----------------------------------------------------------------------------
-- Inserts into the existing public.blog_categories table (created by 011).
-- Idempotent: ON CONFLICT (slug) DO NOTHING preserves any edits an admin made.
-- Rollback: 014_seed_blog_categories_rollback.sql
-- ============================================================================

INSERT INTO public.blog_categories (name, slug, description) VALUES
  ('Buying Guides',      'buying-guides',      'How to choose the right laptop for a given need.'),
  ('Budget Guides',      'budget-guides',      'Best laptops within a specific price range in India.'),
  ('Course-wise Guides', 'course-wise-guides', 'Laptop recommendations tailored to a specific course or stream.'),
  ('Comparisons',        'comparisons',        'Head-to-head comparisons (e.g. MacBook vs Windows).'),
  ('Specs Explained',    'specs-explained',    'Plain-language explainers of CPUs, GPUs, RAM, storage, and displays.'),
  ('Tips & Mistakes',    'tips-and-mistakes',  'Practical buying advice and common mistakes to avoid.'),
  ('For Parents',        'for-parents',        'Guidance for parents buying a laptop for their child.')
ON CONFLICT (slug) DO NOTHING;
