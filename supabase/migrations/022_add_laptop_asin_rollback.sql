-- 022 ROLLBACK — drops the asin column and its index added by 022_add_laptop_asin.sql
DROP INDEX IF EXISTS public.laptops_domain_asin_idx;
ALTER TABLE public.laptops DROP COLUMN IF EXISTS asin;
