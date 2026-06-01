CREATE TABLE IF NOT EXISTS public.laptops (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    TEXT NOT NULL UNIQUE,
  name                    TEXT NOT NULL,
  brand                   TEXT,
  model                   TEXT,
  price_approx            INTEGER,
  price_label             TEXT,
  amazon_affiliate_url    TEXT NOT NULL,
  image_url               TEXT,
  cpu                     TEXT,
  gpu                     TEXT,
  gpu_vram_gb             NUMERIC(4,1),
  ram                     TEXT,
  ram_gb                  INTEGER,
  storage                 TEXT,
  storage_gb              INTEGER,
  display                 TEXT,
  weight                  TEXT,
  os                      TEXT,
  tier                    TEXT CHECK (tier IN ('budget','value','balanced','advanced','premium')),
  workload_tags           TEXT[] DEFAULT '{}',
  recommended_for_courses TEXT[] DEFAULT '{}',
  not_ideal_for           TEXT[] DEFAULT '{}',
  why_recommended         TEXT,
  cautions                TEXT,
  upgrade_notes           TEXT,
  four_year_suitability   TEXT CHECK (four_year_suitability IN ('basic','good','strong','excellent')),
  priority_score          INTEGER NOT NULL DEFAULT 50,
  is_published            BOOLEAN NOT NULL DEFAULT false,
  last_checked            DATE,
  raw_input               TEXT,
  openai_processed_json   JSONB,
  created_by              TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER laptops_updated_at
  BEFORE UPDATE ON public.laptops
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS laptops_fts_idx ON public.laptops
  USING gin(to_tsvector('english',
    coalesce(name,'') || ' ' ||
    coalesce(brand,'') || ' ' ||
    coalesce(cpu,'') || ' ' ||
    coalesce(gpu,'')
  ));

CREATE INDEX IF NOT EXISTS laptops_published_idx
  ON public.laptops (is_published, priority_score DESC);
