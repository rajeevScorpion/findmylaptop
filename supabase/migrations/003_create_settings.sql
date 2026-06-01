CREATE TABLE IF NOT EXISTS public.settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.settings (key, value) VALUES
  ('whatsapp_url',    'https://chat.whatsapp.com/REPLACE_WITH_GROUP_LINK'),
  ('disclaimer_text', 'Prices are approximate and change frequently. Affiliate links may earn a small commission at no extra cost to the buyer. Recommendations are educational and based on design workload suitability. Please verify specs, warranty, seller, return policy, and price before purchasing. No exclusive endorsement of any brand.')
ON CONFLICT (key) DO NOTHING;
