-- ============================================================================
-- 022 — Add `asin` to public.laptops (reliable duplicate detection)
-- ----------------------------------------------------------------------------
-- Stored Amazon URLs are mostly amzn.to short links, which hide the ASIN behind
-- a redirect — so we can't dedup by matching the ASIN against the URL string.
-- This column stores the resolved 10-char ASIN so duplicate detection is an
-- exact, indexed lookup scoped per domain (the same laptop may legitimately
-- exist across Design / Technology / Management).
-- Idempotent: ADD COLUMN IF NOT EXISTS; CREATE INDEX IF NOT EXISTS.
-- Backfill existing rows via /api/admin/backfill-asins after applying.
-- Rollback: 022_add_laptop_asin_rollback.sql
-- ============================================================================

ALTER TABLE public.laptops
  ADD COLUMN IF NOT EXISTS asin TEXT;

-- Duplicate check filters by (domain, asin); index keeps it cheap.
CREATE INDEX IF NOT EXISTS laptops_domain_asin_idx
  ON public.laptops (domain, asin)
  WHERE asin IS NOT NULL;
