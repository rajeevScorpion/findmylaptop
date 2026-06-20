-- Rollback for 016_seed_voice_flag.sql
DELETE FROM public.settings WHERE key = 'voice_input_enabled';
