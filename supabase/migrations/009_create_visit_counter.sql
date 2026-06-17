-- Single-row visit counter. Seeded at 2027 to continue from the existing
-- page-view total. Accessed only via the service role key in /api/visits;
-- no RLS policies so it is never exposed to anon/authenticated roles.
CREATE TABLE IF NOT EXISTS public.visit_counter (
  id    INTEGER PRIMARY KEY DEFAULT 1,
  count BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT visit_counter_singleton CHECK (id = 1)
);

INSERT INTO public.visit_counter (id, count) VALUES (1, 2027)
ON CONFLICT (id) DO NOTHING;

-- Atomic increment that returns the new total in one round-trip.
CREATE OR REPLACE FUNCTION public.increment_visit_count()
RETURNS BIGINT
LANGUAGE sql
AS $$
  UPDATE public.visit_counter SET count = count + 1 WHERE id = 1
  RETURNING count;
$$;
