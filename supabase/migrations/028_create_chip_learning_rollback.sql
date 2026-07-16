-- ============================================================================
-- 028 ROLLBACK - removes ONLY privacy-minimized Chip learning tables
-- ----------------------------------------------------------------------------
-- Existing chat sessions, transcripts, feedback, laptops, and settings remain.
-- ============================================================================

DROP TABLE IF EXISTS public.chip_interaction_events CASCADE;
DROP TABLE IF EXISTS public.chip_session_profiles   CASCADE;
