-- ============================================================================
-- 019 — Seed Technology & Management taxonomies; order the Design taxonomy
-- ----------------------------------------------------------------------------
-- Design programmes already exist (004) and were backfilled to domain='design'
-- by 018. Here we (a) assign them an explicit sort_order so the finder keeps
-- the original programme order, and (b) seed starter Technology & Management
-- programmes. All idempotent. Admins can add/edit/remove programmes later via
-- the admin Taxonomy panel. Rollback: 019_seed_domain_taxonomies_rollback.sql
--
-- sort_order convention: category_base (x100) + specialisation_index, scoped
-- per domain (the finder filters by domain, so ranges may repeat across them).
-- ============================================================================

-- --- Design: preserve original programme ordering ---------------------------
UPDATE public.courses SET sort_order = 101 WHERE domain='design' AND name='Fashion Design & Technology';
UPDATE public.courses SET sort_order = 102 WHERE domain='design' AND name='Fashion Communication & Styling';
UPDATE public.courses SET sort_order = 103 WHERE domain='design' AND name='Luxury & Brand Management';
UPDATE public.courses SET sort_order = 201 WHERE domain='design' AND name='Communication Design';
UPDATE public.courses SET sort_order = 202 WHERE domain='design' AND name='Digital Design';
UPDATE public.courses SET sort_order = 301 WHERE domain='design' AND name='Product & Service Design';
UPDATE public.courses SET sort_order = 302 WHERE domain='design' AND name='Interaction Design';
UPDATE public.courses SET sort_order = 303 WHERE domain='design' AND name='Transportation & Mobility Design';
UPDATE public.courses SET sort_order = 401 WHERE domain='design' AND name='Game Art';
UPDATE public.courses SET sort_order = 402 WHERE domain='design' AND name='Game Design / Programming';
UPDATE public.courses SET sort_order = 403 WHERE domain='design' AND name='Animation & Film Making';
UPDATE public.courses SET sort_order = 501 WHERE domain='design' AND name='Interior Architecture & Design';
UPDATE public.courses SET sort_order = 601 WHERE domain='design' AND name='AI in Creative Practice';
UPDATE public.courses SET sort_order = 701 WHERE domain='design' AND name='Global Design Programme';

-- --- Technology -------------------------------------------------------------
INSERT INTO public.courses (domain, category, name, workload_level, sort_order) VALUES
  ('technology', 'Software & Web',    'Full-Stack / Web Development', 'balanced', 101),
  ('technology', 'Software & Web',    'Frontend Engineering',         'balanced', 102),
  ('technology', 'Software & Web',    'Backend & APIs',               'balanced', 103),
  ('technology', 'Data & AI',         'Data Science',                 'heavy',    201),
  ('technology', 'Data & AI',         'Machine Learning / AI',        'heavy',    202),
  ('technology', 'Data & AI',         'Data Engineering',             'balanced', 203),
  ('technology', 'Systems & Cloud',   'DevOps & Cloud',               'balanced', 301),
  ('technology', 'Systems & Cloud',   'Cybersecurity',                'balanced', 302),
  ('technology', 'Mobile & Game',     'Mobile App Development',       'balanced', 401),
  ('technology', 'Mobile & Game',     'Game Programming',             'heavy',    402)
ON CONFLICT (domain, name) DO NOTHING;

-- --- Management -------------------------------------------------------------
INSERT INTO public.courses (domain, category, name, workload_level, sort_order) VALUES
  ('management', 'Business & Strategy',  'MBA / General Management', 'light',    101),
  ('management', 'Business & Strategy',  'Business Analytics',       'balanced', 102),
  ('management', 'Finance',              'Finance & FinTech',        'balanced', 201),
  ('management', 'Marketing',            'Marketing & Digital Marketing', 'light', 301),
  ('management', 'Operations & Product', 'Operations & Supply Chain', 'light',   401),
  ('management', 'Operations & Product', 'Product Management',        'balanced', 402)
ON CONFLICT (domain, name) DO NOTHING;
