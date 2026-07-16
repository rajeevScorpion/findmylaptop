-- ============================================================================
-- 030 ROLLBACK - removes ONLY privacy-minimized affiliate click events
-- ----------------------------------------------------------------------------
-- Existing laptops, product offers, source settings, and affiliate URLs remain.
-- ============================================================================

DROP TABLE IF EXISTS public.affiliate_click_events CASCADE;
