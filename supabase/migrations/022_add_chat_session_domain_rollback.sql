-- Rollback for 022_add_chat_session_domain.sql
ALTER TABLE public.chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_domain_check;
ALTER TABLE public.chat_sessions DROP COLUMN IF EXISTS domain;
