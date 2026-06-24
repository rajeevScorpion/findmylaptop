-- ============================================================================
-- 022 — Add `domain` to public.chat_sessions (which discipline a chat came from)
-- ----------------------------------------------------------------------------
-- Chip is scoped per domain (design / technology / management) and the client
-- already sends the active domain with every chat request. Persist it on the
-- session so the admin feedback view can show where each conversation
-- originated. Existing sessions predate multi-domain, so default to 'design'.
-- Idempotent: ADD COLUMN IF NOT EXISTS; constraint guarded by a catalog check.
-- Rollback: 022_add_chat_session_domain_rollback.sql
-- ============================================================================

ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS domain TEXT NOT NULL DEFAULT 'design';

UPDATE public.chat_sessions SET domain = 'design' WHERE domain IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_sessions_domain_check'
  ) THEN
    ALTER TABLE public.chat_sessions
      ADD CONSTRAINT chat_sessions_domain_check
      CHECK (domain IN ('design','technology','management'));
  END IF;
END $$;
