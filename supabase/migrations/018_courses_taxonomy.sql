-- ============================================================================
-- 018 — Turn public.courses into the live, admin-managed taxonomy
-- ----------------------------------------------------------------------------
-- The courses table (001/004) was never queried by the app — the live taxonomy
-- was hardcoded in src/lib/constants.ts. We repurpose courses as the single
-- source of truth: domain -> category (programme) -> name (specialisation).
--
--   domain      NEW   'design' | 'technology' | 'management'
--   category    EXIST programme group, e.g. 'Game, Animation, and Film'
--   name        EXIST specialisation, e.g. 'Game Art'
--   sort_order  NEW   admin-controlled ordering within a domain
--   is_active   NEW   soft-delete flag (avoids orphaning laptop course tags)
--   updated_at  NEW   maintained by handle_updated_at trigger
--
-- The old UNIQUE(name) is replaced with UNIQUE(domain, name): the same label
-- may legitimately recur across domains (e.g. "Product Management").
-- Idempotent throughout. Rollback: 018_courses_taxonomy_rollback.sql
-- ============================================================================

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS domain     TEXT    NOT NULL DEFAULT 'design',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Existing rows are all Design (DEFAULT covers them; be explicit for clarity).
UPDATE public.courses SET domain = 'design' WHERE domain IS NULL;

-- Admins adding a programme should not be forced to choose a workload level.
ALTER TABLE public.courses ALTER COLUMN workload_level SET DEFAULT 'balanced';

-- Constrain domain to the three supported values.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_domain_check'
  ) THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_domain_check
      CHECK (domain IN ('design','technology','management'));
  END IF;
END $$;

-- Replace UNIQUE(name) with UNIQUE(domain, name). The same specialisation label
-- may legitimately recur across domains. Find and drop whatever single-column
-- UNIQUE constraint exists on `name` (its name varies, so don't assume it).
DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_attribute a
    ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
  WHERE con.conrelid = 'public.courses'::regclass
    AND con.contype = 'u'
  GROUP BY con.conname
  HAVING array_agg(a.attname::text ORDER BY a.attname::text) = ARRAY['name'];

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.courses DROP CONSTRAINT %I', cname);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_domain_name_key'
  ) THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_domain_name_key UNIQUE (domain, name);
  END IF;
END $$;

-- The finder reads active programmes for one domain in display order.
CREATE INDEX IF NOT EXISTS courses_domain_active_idx
  ON public.courses (domain, is_active, sort_order);

-- Maintain updated_at on edits (function defined in 002_create_laptops.sql).
DROP TRIGGER IF EXISTS courses_updated_at ON public.courses;
CREATE TRIGGER courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
