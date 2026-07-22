-- Rollback for 034_add_product_curation.sql
-- Stop curation and deploy compatible code before running this rollback.
BEGIN;
DROP FUNCTION IF EXISTS public.claim_source_api_budget(TEXT, INTEGER, INTEGER, TIMESTAMPTZ);
DROP TABLE IF EXISTS public.source_api_usage;
DROP TABLE IF EXISTS public.product_curation_proposals;
DROP TABLE IF EXISTS public.product_curation_schedule;
DROP TABLE IF EXISTS public.product_curation_rulebooks;
DROP INDEX IF EXISTS public.product_candidates_domain_queue_idx;
ALTER TABLE public.product_candidates
  DROP CONSTRAINT IF EXISTS product_candidates_gap_reason_length_check,
  DROP CONSTRAINT IF EXISTS product_candidates_curation_score_check,
  DROP CONSTRAINT IF EXISTS product_candidates_portfolio_role_check,
  DROP CONSTRAINT IF EXISTS product_candidates_target_domain_check,
  DROP COLUMN IF EXISTS discovered_by_agent,
  DROP COLUMN IF EXISTS curation_score,
  DROP COLUMN IF EXISTS gap_reason,
  DROP COLUMN IF EXISTS portfolio_role,
  DROP COLUMN IF EXISTS rulebook_version,
  DROP COLUMN IF EXISTS suggested_course_names,
  DROP COLUMN IF EXISTS target_domain;
COMMIT;
