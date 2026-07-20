-- ============================================================================
-- Rollback 032 - Restore migration 005 authenticated catalog/taxonomy writes
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.laptops') IS NULL
     OR to_regclass('public.courses') IS NULL THEN
    RAISE EXCEPTION 'Required catalog/taxonomy tables are missing';
  END IF;
END;
$$;

ALTER TABLE public.laptops NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.courses NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.laptops FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.courses FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.laptops TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.laptops TO authenticated;
GRANT SELECT ON TABLE public.courses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.courses TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.laptops TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.courses TO service_role;

DROP POLICY IF EXISTS "laptops_authenticated_insert" ON public.laptops;
DROP POLICY IF EXISTS "laptops_authenticated_update" ON public.laptops;
DROP POLICY IF EXISTS "laptops_authenticated_delete" ON public.laptops;
DROP POLICY IF EXISTS "courses_authenticated_write" ON public.courses;

CREATE POLICY "laptops_authenticated_insert"
  ON public.laptops FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "laptops_authenticated_update"
  ON public.laptops FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "laptops_authenticated_delete"
  ON public.laptops FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "courses_authenticated_write"
  ON public.courses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.laptops IS NULL;
COMMENT ON TABLE public.courses IS NULL;
