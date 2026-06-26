-- Rollback for 023_seed_workload_filter_flag.sql
DELETE FROM public.settings WHERE key = 'workload_filter_enabled';
