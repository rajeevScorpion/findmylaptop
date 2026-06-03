CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id       TEXT UNIQUE NOT NULL,
  message_count    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_sessions_session_id_idx
  ON public.chat_sessions (session_id);

-- No RLS policies: this table is accessed only via the service role key
-- in the /api/chat server route. It must never be exposed to anon/authenticated roles.
