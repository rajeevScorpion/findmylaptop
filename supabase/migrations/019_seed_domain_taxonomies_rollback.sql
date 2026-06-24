-- Rollback for 019_seed_domain_taxonomies.sql
-- Removes the seeded Technology & Management programmes. Design sort_order
-- values are left as-is (harmless; they only affect display order).
DELETE FROM public.courses WHERE domain IN ('technology','management');
