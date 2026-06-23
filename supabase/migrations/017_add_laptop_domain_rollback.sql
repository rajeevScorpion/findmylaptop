-- Rollback for 017_add_laptop_domain.sql
DROP INDEX IF EXISTS public.laptops_domain_published_idx;
ALTER TABLE public.laptops DROP CONSTRAINT IF EXISTS laptops_domain_check;
ALTER TABLE public.laptops DROP COLUMN IF EXISTS domain;
