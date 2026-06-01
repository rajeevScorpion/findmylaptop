-- Enable RLS
ALTER TABLE public.courses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laptops  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- COURSES: public read
CREATE POLICY "courses_public_read"
  ON public.courses FOR SELECT
  TO anon, authenticated
  USING (true);

-- COURSES: authenticated write (admin check enforced in application layer)
CREATE POLICY "courses_authenticated_write"
  ON public.courses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- LAPTOPS: anon can only read published laptops
CREATE POLICY "laptops_public_read"
  ON public.laptops FOR SELECT
  TO anon
  USING (is_published = true);

-- LAPTOPS: authenticated can read all (admins need to see drafts)
CREATE POLICY "laptops_authenticated_read"
  ON public.laptops FOR SELECT
  TO authenticated
  USING (true);

-- LAPTOPS: authenticated insert/update/delete (admin check in application layer)
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

-- SETTINGS: public read (WhatsApp URL needed on public page)
CREATE POLICY "settings_public_read"
  ON public.settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- SETTINGS: authenticated write
CREATE POLICY "settings_authenticated_write"
  ON public.settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
