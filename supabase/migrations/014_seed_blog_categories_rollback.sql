-- ============================================================================
-- 014 ROLLBACK — removes ONLY the 7 seeded category rows.
-- Leaves the blog_categories table and any admin-created categories intact.
-- ============================================================================

DELETE FROM public.blog_categories WHERE slug IN (
  'buying-guides',
  'budget-guides',
  'course-wise-guides',
  'comparisons',
  'specs-explained',
  'tips-and-mistakes',
  'for-parents'
);
