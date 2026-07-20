-- ============================================================================
-- 032 - Restrict catalog and taxonomy writes to trusted server code
-- ----------------------------------------------------------------------------
-- Migration 005 allowed every authenticated Supabase account to mutate laptops
-- and courses. Admin mutations now pass through ADMIN_EMAILS-authorized Route
-- Handlers using the service-role client, so browser roles need read access only.
--
-- The current schema has no workload_types, software, or taxonomy junction
-- tables; this migration deliberately targets only the real tables and policies
-- created by migrations 001, 002, and 005.
-- Rollback: 032_harden_catalog_and_taxonomy_access_rollback.sql
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.laptops') IS NULL
     OR to_regclass('public.courses') IS NULL THEN
    RAISE EXCEPTION 'Required catalog/taxonomy tables are missing';
  END IF;
END;
$$;

DROP POLICY IF EXISTS "laptops_authenticated_insert" ON public.laptops;
DROP POLICY IF EXISTS "laptops_authenticated_update" ON public.laptops;
DROP POLICY IF EXISTS "laptops_authenticated_delete" ON public.laptops;
DROP POLICY IF EXISTS "courses_authenticated_write" ON public.courses;

ALTER TABLE public.laptops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laptops FORCE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses FORCE ROW LEVEL SECURITY;

-- Preserve the existing public/authenticated SELECT policies while removing
-- all browser mutation grants. Authenticated admins can still read draft rows;
-- writes are performed by the service-role APIs.
REVOKE ALL ON TABLE public.laptops FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.courses FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.laptops TO anon, authenticated;
GRANT SELECT ON TABLE public.courses TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.laptops TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.courses TO service_role;

COMMENT ON TABLE public.laptops IS
  'Public catalog with browser read policies; mutations require trusted service-role APIs.';
COMMENT ON TABLE public.courses IS
  'Public programme taxonomy with browser read policies; mutations require trusted service-role APIs.';
