-- Rollback for 018_courses_taxonomy.sql
-- Best-effort restore to the pre-018 shape. Run 019's rollback first if the
-- tech/management seed rows are present, otherwise re-adding UNIQUE(name) may
-- fail on duplicate names across domains.
DROP TRIGGER IF EXISTS courses_updated_at ON public.courses;
DROP INDEX IF EXISTS public.courses_domain_active_idx;
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_domain_name_key;
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_domain_check;
ALTER TABLE public.courses ALTER COLUMN workload_level DROP DEFAULT;
ALTER TABLE public.courses
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS sort_order,
  DROP COLUMN IF EXISTS domain;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_name_key'
  ) THEN
    ALTER TABLE public.courses ADD CONSTRAINT courses_name_key UNIQUE (name);
  END IF;
END $$;
