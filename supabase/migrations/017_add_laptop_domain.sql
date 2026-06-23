-- ============================================================================
-- 017 — Add a `domain` to public.laptops (Design / Technology / Management)
-- ----------------------------------------------------------------------------
-- Each laptop belongs to exactly one domain. Existing rows are all Design, so
-- the column defaults to 'design' and existing rows are backfilled explicitly.
-- Idempotent: ADD COLUMN IF NOT EXISTS; the backfill is safe to re-run.
-- Rollback: 017_add_laptop_domain_rollback.sql
-- ============================================================================

ALTER TABLE public.laptops
  ADD COLUMN IF NOT EXISTS domain TEXT NOT NULL DEFAULT 'design';

-- Backfill any pre-existing rows (DEFAULT already covers them, but be explicit).
UPDATE public.laptops SET domain = 'design' WHERE domain IS NULL;

-- Constrain to the three supported domains.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'laptops_domain_check'
  ) THEN
    ALTER TABLE public.laptops
      ADD CONSTRAINT laptops_domain_check
      CHECK (domain IN ('design','technology','management'));
  END IF;
END $$;

-- The public finder queries published laptops within a single domain, ordered
-- by priority. Mirror the existing laptops_published_idx but domain-scoped.
CREATE INDEX IF NOT EXISTS laptops_domain_published_idx
  ON public.laptops (domain, is_published, priority_score DESC);
