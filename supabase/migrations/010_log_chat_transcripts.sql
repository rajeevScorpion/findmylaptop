-- Persist the full conversation on every chat turn so admin can review every
-- session, not only the ones a user chose to rate. Written exclusively via the
-- service role key in /api/chat; no RLS, same as the rest of this table.
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS transcript        JSONB,            -- [{role, content}] array
  ADD COLUMN IF NOT EXISTS recommended_slugs TEXT[] NOT NULL DEFAULT '{}';

-- Admin feedback view lists conversations newest-activity first.
CREATE INDEX IF NOT EXISTS chat_sessions_last_message_at_idx
  ON public.chat_sessions (last_message_at DESC);
