-- Rollback for 026_create_research_calendar.sql
-- Run only after automation is disabled and after preserving any research
-- packets or run history that must be retained.

DROP FUNCTION IF EXISTS public.reclaim_research_calendar_lease(
  UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ
);
DROP FUNCTION IF EXISTS public.finish_research_schedule_run(
  UUID, UUID, UUID, TIMESTAMPTZ, TEXT, INTEGER, INTEGER, JSONB, TEXT, TEXT,
  JSONB, TIMESTAMPTZ
);
DROP FUNCTION IF EXISTS public.persist_research_packets(UUID, UUID, UUID, JSONB);
DROP FUNCTION IF EXISTS public.research_execution_is_active(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.claim_research_schedule_run(
  UUID, UUID, UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TIMESTAMPTZ
);

DROP TABLE IF EXISTS public.research_packets;
DROP TABLE IF EXISTS public.research_schedule_runs;
DROP TABLE IF EXISTS public.research_calendar_days;
DROP TABLE IF EXISTS public.research_editorial_calendars;
