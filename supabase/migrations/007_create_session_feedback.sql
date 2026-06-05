CREATE TABLE IF NOT EXISTS public.session_feedback (
  id                UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id        TEXT    NOT NULL REFERENCES public.chat_sessions(session_id) ON DELETE CASCADE,
  rating            BOOLEAN NOT NULL,             -- true = 👍, false = 👎
  comment           TEXT,
  transcript        JSONB,                        -- [{role, content}] array
  recommended_slugs TEXT[]  DEFAULT '{}',
  message_count     INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT one_feedback_per_session UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS session_feedback_rating_idx     ON public.session_feedback (rating);
CREATE INDEX IF NOT EXISTS session_feedback_created_at_idx ON public.session_feedback (created_at DESC);

-- No RLS: accessed only via service role key, same as chat_sessions
