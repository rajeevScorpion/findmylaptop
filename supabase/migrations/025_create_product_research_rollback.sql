-- ============================================================================
-- 025 ROLLBACK - removes ONLY product research candidates and source offers
-- ----------------------------------------------------------------------------
-- Run before 024_create_agent_foundations_rollback.sql. The existing laptops
-- table and laptops.amazon_affiliate_url column are not changed.
-- ============================================================================

DROP TABLE IF EXISTS public.product_offers     CASCADE;
DROP TABLE IF EXISTS public.product_candidates CASCADE;
