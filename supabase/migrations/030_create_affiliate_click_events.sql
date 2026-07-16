-- ============================================================================
-- 030 - Privacy-minimized outbound affiliate click events (ADDITIVE ONLY)
-- ----------------------------------------------------------------------------
-- Stores aggregate-safe click metadata for centrally resolved product links.
-- It intentionally has no URL, IP address, user-agent, cookie, session, user,
-- referrer, or free-form metadata columns.
-- Requires: 024_create_agent_foundations.sql, 025_create_product_research.sql
-- Rollback: 030_create_affiliate_click_events_rollback.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.affiliate_click_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laptop_id         UUID REFERENCES public.laptops(id) ON DELETE SET NULL,
  offer_id          UUID REFERENCES public.product_offers(id) ON DELETE SET NULL,
  source_key        TEXT NOT NULL,
  placement         TEXT NOT NULL,
  destination_hash  TEXT NOT NULL,
  destination_kind  TEXT NOT NULL,
  monetized         BOOLEAN NOT NULL DEFAULT false,
  clicked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT affiliate_click_events_source_key_check
    CHECK (source_key ~ '^[a-z][a-z0-9_-]{0,63}$'),
  CONSTRAINT affiliate_click_events_placement_check
    CHECK (placement IN (
      'product_card',
      'mini_card',
      'comparison',
      'laptop_detail',
      'laptop_alternative',
      'blog_product',
      'chip_recommendation',
      'where_to_buy',
      'deal_page'
    )),
  CONSTRAINT affiliate_click_events_destination_hash_check
    CHECK (destination_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT affiliate_click_events_destination_kind_check
    CHECK (destination_kind IN ('affiliate', 'canonical'))
);

COMMENT ON TABLE public.affiliate_click_events IS
  'Privacy-minimized outbound product-link events. Retain only hashed destinations and aggregate dimensions.';
COMMENT ON COLUMN public.affiliate_click_events.destination_hash IS
  'SHA-256 hash used for aggregation; the raw destination URL must never be stored.';

-- Retention deletion scans use clicked_at directly; the remaining indexes
-- support source, placement, laptop, and offer aggregates without user data.
CREATE INDEX IF NOT EXISTS affiliate_click_events_retention_idx
  ON public.affiliate_click_events (clicked_at);
CREATE INDEX IF NOT EXISTS affiliate_click_events_source_time_idx
  ON public.affiliate_click_events (source_key, clicked_at DESC);
CREATE INDEX IF NOT EXISTS affiliate_click_events_placement_time_idx
  ON public.affiliate_click_events (placement, clicked_at DESC);
CREATE INDEX IF NOT EXISTS affiliate_click_events_laptop_time_idx
  ON public.affiliate_click_events (laptop_id, clicked_at DESC)
  WHERE laptop_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS affiliate_click_events_offer_time_idx
  ON public.affiliate_click_events (offer_id, clicked_at DESC)
  WHERE offer_id IS NOT NULL;

ALTER TABLE public.affiliate_click_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_click_events FORCE ROW LEVEL SECURITY;

-- No browser policy is created. Only trusted server code may insert/read for
-- aggregate reporting or delete rows according to the configured retention.
REVOKE ALL ON TABLE public.affiliate_click_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.affiliate_click_events TO service_role;
