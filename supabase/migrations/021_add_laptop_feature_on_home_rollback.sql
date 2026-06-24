-- Rollback for 021_add_laptop_feature_on_home.sql
DROP INDEX IF EXISTS public.laptops_feature_on_home_idx;
ALTER TABLE public.laptops DROP COLUMN IF EXISTS feature_on_home;
