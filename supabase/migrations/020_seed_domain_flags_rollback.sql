-- Rollback for 020_seed_domain_flags.sql
DELETE FROM public.settings WHERE key IN ('domain_tech_enabled','domain_mgmt_enabled');
