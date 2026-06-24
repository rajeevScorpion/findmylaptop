-- ============================================================================
-- 021 — Add `feature_on_home` to public.laptops (Editor's Picks on the hub)
-- ----------------------------------------------------------------------------
-- The new cross-discipline landing page (/) shows an "Editor's Picks" section.
-- Admins explicitly hand-pick which published laptops appear there via this
-- boolean. Defaults to false so nothing changes until a laptop is flagged.
-- Idempotent: ADD COLUMN IF NOT EXISTS; CREATE INDEX IF NOT EXISTS.
-- Rollback: 021_add_laptop_feature_on_home_rollback.sql
-- ============================================================================

ALTER TABLE public.laptops
  ADD COLUMN IF NOT EXISTS feature_on_home BOOLEAN NOT NULL DEFAULT false;

-- The hub queries only the (small) set of featured, published laptops ordered
-- by priority. A partial index keeps that lookup cheap.
CREATE INDEX IF NOT EXISTS laptops_feature_on_home_idx
  ON public.laptops (priority_score DESC)
  WHERE feature_on_home;
