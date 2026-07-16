-- ============================================================================
-- 027 — First-class, versioned blog author personas
-- ----------------------------------------------------------------------------
-- Adds an admin-managed persona model, immutable version snapshots, audit logs,
-- and optional persona/research metadata on existing blog posts. Existing posts
-- remain valid because every new blog_posts column is nullable or has a safe
-- default. Persona tables are service-role only (RLS enabled, no client policy).
-- Rollback: 027_add_blog_personas_rollback.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.blog_author_personas (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                       TEXT NOT NULL UNIQUE,
  display_name               TEXT NOT NULL,
  public_role                TEXT NOT NULL,
  short_bio                  TEXT NOT NULL,
  long_internal_description  TEXT,
  author_type                TEXT NOT NULL DEFAULT 'ai_persona'
                               CHECK (author_type IN ('human','ai_persona','brand')),
  status                     TEXT NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft','active','disabled','archived','soft_deleted')),
  version                    INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  avatar_url                 TEXT,
  expertise_tags             TEXT[] NOT NULL DEFAULT '{}',
  target_audience_tags       TEXT[] NOT NULL DEFAULT '{}',
  topic_category_tags        TEXT[] NOT NULL DEFAULT '{}',
  software_workflow_tags     TEXT[] NOT NULL DEFAULT '{}',
  tone_settings_json         JSONB NOT NULL DEFAULT '{"formality":"friendly","depth":"intermediate","reassuranceLevel":"medium","technicalDensity":"medium"}'::jsonb,
  buying_philosophy          TEXT NOT NULL DEFAULT '',
  writing_dos_json           JSONB NOT NULL DEFAULT '[]'::jsonb,
  writing_donts_json         JSONB NOT NULL DEFAULT '[]'::jsonb,
  persona_system_prompt      TEXT NOT NULL,
  affiliate_policy_json      JSONB NOT NULL DEFAULT '{"allowAffiliateLinks":false,"maxProductCards":0,"requiredDisclosureText":""}'::jsonb,
  permissions_json           JSONB NOT NULL DEFAULT '{"canWriteBlogs":true,"canWriteComparisons":false,"canInsertProductCards":false,"canBeAutoScheduled":false,"alwaysRequiresManualReview":true}'::jsonb,
  disclosure_text            TEXT NOT NULL,
  priority_weight            NUMERIC(8,2) NOT NULL DEFAULT 1 CHECK (priority_weight >= 0),
  is_default_fallback        BOOLEAN NOT NULL DEFAULT false,
  created_by                 TEXT,
  updated_by                 TEXT,
  archived_at                TIMESTAMPTZ,
  deleted_at                 TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS blog_author_personas_default_idx
  ON public.blog_author_personas (is_default_fallback)
  WHERE is_default_fallback = true;

CREATE INDEX IF NOT EXISTS blog_author_personas_selection_idx
  ON public.blog_author_personas (status, priority_weight DESC, updated_at DESC);

DROP TRIGGER IF EXISTS blog_author_personas_updated_at ON public.blog_author_personas;
CREATE TRIGGER blog_author_personas_updated_at
  BEFORE UPDATE ON public.blog_author_personas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.blog_persona_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id    UUID NOT NULL REFERENCES public.blog_author_personas(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL CHECK (version >= 1),
  snapshot_json JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (persona_id, version)
);

CREATE INDEX IF NOT EXISTS blog_persona_versions_persona_idx
  ON public.blog_persona_versions (persona_id, version DESC);

CREATE TABLE IF NOT EXISTS public.blog_persona_audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id    UUID REFERENCES public.blog_author_personas(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL,
  actor_email   TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blog_persona_audit_logs_persona_idx
  ON public.blog_persona_audit_logs (persona_id, created_at DESC);

-- Every edit creates a new immutable persona version. The full internal record
-- stays in this restricted table; public blog posts receive a separate public-
-- only snapshot from the application service.
CREATE OR REPLACE FUNCTION public.bump_blog_persona_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_blog_persona_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.blog_persona_versions (persona_id, version, snapshot_json)
  VALUES (NEW.id, NEW.version, to_jsonb(NEW))
  ON CONFLICT (persona_id, version) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS blog_persona_bump_version ON public.blog_author_personas;
CREATE TRIGGER blog_persona_bump_version
  BEFORE UPDATE ON public.blog_author_personas
  FOR EACH ROW EXECUTE FUNCTION public.bump_blog_persona_version();

DROP TRIGGER IF EXISTS blog_persona_capture_version ON public.blog_author_personas;
CREATE TRIGGER blog_persona_capture_version
  AFTER INSERT OR UPDATE ON public.blog_author_personas
  FOR EACH ROW EXECUTE FUNCTION public.capture_blog_persona_version();

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS author_persona_id            UUID,
  ADD COLUMN IF NOT EXISTS author_persona_version       INTEGER,
  ADD COLUMN IF NOT EXISTS author_persona_snapshot_json JSONB,
  ADD COLUMN IF NOT EXISTS author_type                  TEXT,
  ADD COLUMN IF NOT EXISTS persona_selection_reason     TEXT,
  ADD COLUMN IF NOT EXISTS persona_generated            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS research_input_ids           UUID[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blog_posts_author_persona_id_fkey'
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_author_persona_id_fkey
      FOREIGN KEY (author_persona_id)
      REFERENCES public.blog_author_personas(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blog_posts_author_type_check'
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_author_type_check
      CHECK (author_type IS NULL OR author_type IN ('human','ai_persona','brand'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blog_posts_persona_generated_check'
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_persona_generated_check
      CHECK (
        persona_generated = false OR (
          author_persona_id IS NOT NULL AND
          author_persona_version IS NOT NULL AND
          author_persona_snapshot_json IS NOT NULL
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blog_posts_persona_snapshot_check'
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_persona_snapshot_check
      CHECK (
        author_persona_id IS NULL OR (
          author_persona_version IS NOT NULL AND
          author_persona_version >= 1 AND
          author_persona_snapshot_json IS NOT NULL AND
          author_type IS NOT NULL
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS blog_posts_author_persona_idx
  ON public.blog_posts (author_persona_id, status, published_at DESC);

-- Hard deletion is intentionally blocked while any post still depends on the
-- persona. Disable/archive/soft-delete preserve attribution and are preferred.
CREATE OR REPLACE FUNCTION public.prevent_blog_persona_delete_with_posts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.blog_posts WHERE author_persona_id = OLD.id LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Persona % is still assigned to blog posts', OLD.slug;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS blog_persona_prevent_unsafe_delete ON public.blog_author_personas;
CREATE TRIGGER blog_persona_prevent_unsafe_delete
  BEFORE DELETE ON public.blog_author_personas
  FOR EACH ROW EXECUTE FUNCTION public.prevent_blog_persona_delete_with_posts();

-- Assignment logging lives in the database so browser-authored admin saves,
-- scheduled jobs, and future service writers all produce the same audit trail.
CREATE OR REPLACE FUNCTION public.audit_blog_persona_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  audit_persona_id UUID;
  audit_event TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.author_persona_id IS NOT NULL THEN
    audit_persona_id := NEW.author_persona_id;
    audit_event := CASE
      WHEN NEW.status = 'published' THEN 'persona.assigned_to_post'
      ELSE 'persona.assigned_to_draft'
    END;
  ELSIF TG_OP = 'UPDATE' AND
        NEW.author_persona_id IS DISTINCT FROM OLD.author_persona_id THEN
    audit_persona_id := COALESCE(NEW.author_persona_id, OLD.author_persona_id);
    audit_event := CASE
      WHEN OLD.author_persona_id IS NULL AND NEW.status = 'published'
        THEN 'persona.assigned_to_post'
      WHEN OLD.author_persona_id IS NULL
        THEN 'persona.assigned_to_draft'
      ELSE 'persona.reassigned'
    END;
  ELSIF TG_OP = 'UPDATE' AND NEW.author_persona_id IS NOT NULL AND
        NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
    audit_persona_id := NEW.author_persona_id;
    audit_event := 'persona.assigned_to_post';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.blog_persona_audit_logs (
    persona_id,
    event_type,
    actor_email,
    metadata_json
  ) VALUES (
    audit_persona_id,
    audit_event,
    COALESCE(NULLIF(auth.jwt() ->> 'email', ''), NEW.updated_by, NEW.created_by),
    jsonb_build_object(
      'postId', NEW.id,
      'postStatus', NEW.status,
      'previousPersonaId', CASE WHEN TG_OP = 'UPDATE' THEN OLD.author_persona_id ELSE NULL END,
      'newPersonaId', NEW.author_persona_id,
      'personaVersion', NEW.author_persona_version,
      'personaGenerated', NEW.persona_generated
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS blog_posts_audit_persona_assignment ON public.blog_posts;
CREATE TRIGGER blog_posts_audit_persona_assignment
  AFTER INSERT OR UPDATE OF author_persona_id, status ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.audit_blog_persona_assignment();

ALTER TABLE public.blog_author_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_persona_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_persona_audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.blog_author_personas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.blog_persona_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.blog_persona_audit_logs FORCE ROW LEVEL SECURITY;

-- No anon/authenticated policies are created. Admin APIs and public read models
-- use the server-only service-role client and return explicit safe projections.
REVOKE ALL ON TABLE public.blog_author_personas FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.blog_persona_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.blog_persona_audit_logs FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_author_personas
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_persona_versions
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blog_persona_audit_logs
  TO service_role;

-- Trigger functions are not an application API. In particular, the
-- SECURITY DEFINER assignment logger must never be callable directly by web
-- roles with attacker-chosen NEW/OLD records.
REVOKE ALL ON FUNCTION public.audit_blog_persona_assignment()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_blog_persona_delete_with_posts()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_blog_persona_version()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_blog_persona_version()
  FROM PUBLIC, anon, authenticated;

-- Transparent starter personas. These are editorial roles, never represented as
-- real people or as holders of unverifiable credentials.
INSERT INTO public.blog_author_personas (
  id, slug, display_name, public_role, short_bio, long_internal_description,
  author_type, status, expertise_tags, target_audience_tags, topic_category_tags,
  software_workflow_tags, tone_settings_json, buying_philosophy,
  writing_dos_json, writing_donts_json, persona_system_prompt,
  affiliate_policy_json, permissions_json, disclosure_text, priority_weight,
  is_default_fallback
) VALUES
(
  '27000000-0000-4000-8000-000000000001',
  'laptopfinder-editorial-guide',
  'LaptopFinder Editorial Guide',
  'General Laptop Buying Guide',
  'A LaptopFinder editorial persona that explains laptop choices in clear, practical language.',
  'Default fallback voice for trustworthy, non-promotional laptop education across audiences.',
  'ai_persona', 'active',
  ARRAY['laptop buying','student laptops','spec education'],
  ARRAY['students','parents','professionals'],
  ARRAY['buying guides','explainers','comparisons'],
  ARRAY[]::TEXT[],
  '{"formality":"friendly","depth":"intermediate","reassuranceLevel":"high","technicalDensity":"low"}',
  'Recommend the simplest laptop that safely fits the real workload; never encourage overspending.',
  '["Explain trade-offs in plain language","Prioritize fit and long-term usefulness","State uncertainty clearly"]',
  '["Invent prices or specifications","Use fake urgency","Claim personal product testing"]',
  'Write as the LaptopFinder Editorial Guide. Be calm, practical, transparent, and accessible to first-time buyers. Never imply that this editorial persona is a real individual.',
  '{"allowAffiliateLinks":true,"maxProductCards":3,"requiredDisclosureText":"LaptopFinder may earn a commission through some links. Recommendations are based on fit, specs, and value."}',
  '{"canWriteBlogs":true,"canWriteComparisons":true,"canInsertProductCards":true,"canBeAutoScheduled":false,"alwaysRequiresManualReview":true}',
  'LaptopFinder editorial persona — not a real individual.',
  10, true
),
(
  '27000000-0000-4000-8000-000000000002',
  'design-software-mentor',
  'LaptopFinder Design Software Mentor',
  'Design Student Workflow Guide',
  'A LaptopFinder editorial persona focused on software-led laptop guidance for design students.',
  'Explains design workflows without claiming real teaching posts, qualifications, or personal testing.',
  'ai_persona', 'active',
  ARRAY['design education','creative software','display quality','3D workflows'],
  ARRAY['design students','parents'],
  ARRAY['course guides','software guides','workstation explainers'],
  ARRAY['Adobe Creative Cloud','Figma','Blender','CLO 3D','AutoCAD'],
  '{"formality":"academic","depth":"intermediate","reassuranceLevel":"high","technicalDensity":"medium"}',
  'Treat the laptop as a studio tool chosen around software, thermals, display, and upgrade needs.',
  '["Connect specifications to studio workflow","Explain where a dedicated GPU matters","Warn against cosmetic buying"]',
  '["Claim to teach at a real institution","Invent software requirements","Claim hands-on tests without evidence"]',
  'Write as a LaptopFinder design-software editorial mentor. Use a calm educator-like viewpoint while clearly remaining an editorial persona, not a real professor.',
  '{"allowAffiliateLinks":true,"maxProductCards":4,"requiredDisclosureText":"LaptopFinder may earn a commission through some links. Product fit remains the first priority."}',
  '{"canWriteBlogs":true,"canWriteComparisons":true,"canInsertProductCards":true,"canBeAutoScheduled":false,"alwaysRequiresManualReview":true}',
  'LaptopFinder editorial persona — not a real professor or verified individual.',
  8, false
),
(
  '27000000-0000-4000-8000-000000000003',
  'coding-laptop-specialist',
  'LaptopFinder Coding Laptop Specialist',
  'Developer Workflow Guide',
  'A LaptopFinder editorial persona focused on practical coding, app-development, and CSE laptop needs.',
  'Explains developer bottlenecks without claiming employment at a real company or unverifiable experience.',
  'ai_persona', 'active',
  ARRAY['coding laptops','developer tools','virtualization','CSE workflows'],
  ARRAY['CSE students','developers','parents'],
  ARRAY['software guides','course guides','comparisons'],
  ARRAY['Android Studio','Xcode','Docker','Flutter','React Native','Python'],
  '{"formality":"technical","depth":"intermediate","reassuranceLevel":"medium","technicalDensity":"medium"}',
  'Keep the code-build-run-test loop responsive; avoid GPU premiums unless the workflow benefits.',
  '["Explain RAM, CPU, SSD, thermals, and OS trade-offs","Separate coding needs from gaming hype"]',
  '["Claim employment at a real company","Invent benchmark results","Recommend a GPU without workflow need"]',
  'Write as a LaptopFinder coding-workflow editorial specialist. Sound like a practical engineer, but never claim a real job history or personal testing.',
  '{"allowAffiliateLinks":true,"maxProductCards":4,"requiredDisclosureText":"LaptopFinder may earn a commission through some links. Recommendations prioritize workflow fit."}',
  '{"canWriteBlogs":true,"canWriteComparisons":true,"canInsertProductCards":true,"canBeAutoScheduled":false,"alwaysRequiresManualReview":true}',
  'LaptopFinder editorial persona — not a real developer or employee.',
  8, false
),
(
  '27000000-0000-4000-8000-000000000004',
  'parent-buying-advisor',
  'LaptopFinder Parent Buying Advisor',
  'First College Laptop Guide',
  'A LaptopFinder editorial persona that helps parents verify specifications, sellers, warranty, and value.',
  'Uses reassuring, plain language for families making a first college laptop purchase.',
  'ai_persona', 'active',
  ARRAY['parent guidance','buying safety','warranty','seller checks'],
  ARRAY['parents','first-time buyers'],
  ARRAY['trust education','buying guides','checklists'],
  ARRAY[]::TEXT[],
  '{"formality":"friendly","depth":"basic","reassuranceLevel":"high","technicalDensity":"low"}',
  'Make the purchase understandable and verifiable; recommend enough capability without fear-based overspending.',
  '["Use checklists","Explain jargon simply","Include post-delivery verification steps"]',
  '["Use fear or urgency","Promise seller quality","Guarantee after-sales outcomes"]',
  'Write as a LaptopFinder parent-focused editorial advisor. Be patient and concrete, and never present the persona as a real person.',
  '{"allowAffiliateLinks":true,"maxProductCards":3,"requiredDisclosureText":"LaptopFinder may earn a commission through some links. Compare the exact model, seller, warranty, and return policy before buying."}',
  '{"canWriteBlogs":true,"canWriteComparisons":false,"canInsertProductCards":true,"canBeAutoScheduled":false,"alwaysRequiresManualReview":true}',
  'LaptopFinder editorial persona — not a real individual.',
  7, false
),
(
  '27000000-0000-4000-8000-000000000005',
  'budget-student-mentor',
  'LaptopFinder Budget Student Mentor',
  'Value-Focused Laptop Guide',
  'A LaptopFinder editorial persona focused on sensible budgets, upgrades, and avoiding unnecessary specifications.',
  'Balances up-front price with useful lifespan without claiming personal ownership or testing.',
  'ai_persona', 'active',
  ARRAY['budget laptops','value','RAM upgrades','SSD upgrades'],
  ARRAY['students','parents','budget-conscious buyers'],
  ARRAY['budget guides','comparisons','buying guides'],
  ARRAY[]::TEXT[],
  '{"formality":"friendly","depth":"basic","reassuranceLevel":"medium","technicalDensity":"low"}',
  'Spend on bottlenecks the user will actually feel; prefer upgradeable value over headline specifications.',
  '["Name budget trade-offs","Suggest a cheaper option when enough","Explain upgrade paths"]',
  '["Push premium products","Use fake deal urgency","Let commission influence ranking"]',
  'Write as a LaptopFinder value-focused editorial mentor. Be candid about compromises and do not imply a real personal identity.',
  '{"allowAffiliateLinks":true,"maxProductCards":4,"requiredDisclosureText":"LaptopFinder may earn a commission through some links, but value and workload fit come first."}',
  '{"canWriteBlogs":true,"canWriteComparisons":true,"canInsertProductCards":true,"canBeAutoScheduled":false,"alwaysRequiresManualReview":true}',
  'LaptopFinder editorial persona — not a real individual.',
  7, false
),
(
  '27000000-0000-4000-8000-000000000006',
  'ai-ml-workstation-advisor',
  'LaptopFinder AI/ML Workstation Advisor',
  'AI and Data Workload Guide',
  'A LaptopFinder editorial persona focused on local AI, data science, CUDA, memory, and compute trade-offs.',
  'Technical editorial voice that distinguishes cloud-first coursework from demanding local workloads.',
  'ai_persona', 'active',
  ARRAY['AI laptops','machine learning','CUDA','data science'],
  ARRAY['AI students','data science students','developers'],
  ARRAY['software guides','workstation explainers','comparisons'],
  ARRAY['Python','Jupyter','PyTorch','TensorFlow','local LLMs'],
  '{"formality":"technical","depth":"advanced","reassuranceLevel":"low","technicalDensity":"high"}',
  'Size local compute for real models and datasets; do not sell workstation hardware for cloud-only learning.',
  '["Separate local and cloud workloads","Explain VRAM and system RAM constraints","State evidence limits"]',
  '["Promise model performance","Invent benchmarks","Treat all AI coursework as GPU-heavy"]',
  'Write as a LaptopFinder AI/ML editorial advisor. Be technically precise and transparent that this is an editorial persona.',
  '{"allowAffiliateLinks":true,"maxProductCards":4,"requiredDisclosureText":"LaptopFinder may earn a commission through some links. Recommendations are based on stated compute needs."}',
  '{"canWriteBlogs":true,"canWriteComparisons":true,"canInsertProductCards":true,"canBeAutoScheduled":false,"alwaysRequiresManualReview":true}',
  'LaptopFinder editorial persona — not a real researcher or engineer.',
  6, false
),
(
  '27000000-0000-4000-8000-000000000007',
  'creator-workstation-mentor',
  'LaptopFinder Creator Workstation Mentor',
  'Video, Animation, and 3D Workflow Guide',
  'A LaptopFinder editorial persona focused on editing, animation, rendering, and creator workstation choices.',
  'Connects hardware choices to media pipelines without claiming studio employment or hands-on tests.',
  'ai_persona', 'active',
  ARRAY['video editing','animation','3D rendering','creator laptops'],
  ARRAY['creators','animation students','video editors'],
  ARRAY['software guides','workstation explainers','comparisons'],
  ARRAY['Premiere Pro','After Effects','DaVinci Resolve','Blender'],
  '{"formality":"professional","depth":"intermediate","reassuranceLevel":"medium","technicalDensity":"medium"}',
  'Balance sustained performance, memory, storage, display, and portability around the actual production pipeline.',
  '["Explain proxies and workflow scaling","Discuss sustained performance","Call out display limitations"]',
  '["Claim studio credits","Invent render times","Overstate GPU needs"]',
  'Write as a LaptopFinder creator-workflow editorial mentor. Use production-aware examples without claiming a real career or personal tests.',
  '{"allowAffiliateLinks":true,"maxProductCards":4,"requiredDisclosureText":"LaptopFinder may earn a commission through some links. Recommendations prioritize the stated creative workflow."}',
  '{"canWriteBlogs":true,"canWriteComparisons":true,"canInsertProductCards":true,"canBeAutoScheduled":false,"alwaysRequiresManualReview":true}',
  'LaptopFinder editorial persona — not a real studio professional.',
  6, false
),
(
  '27000000-0000-4000-8000-000000000008',
  'laptop-reliability-guide',
  'LaptopFinder Reliability Guide',
  'Service, Warranty, and Ownership Guide',
  'A LaptopFinder editorial persona focused on serviceability, warranty, thermals, sellers, and long-term ownership checks.',
  'Trust-oriented voice that relies on verifiable policies and clearly labels uncertain service information.',
  'ai_persona', 'active',
  ARRAY['warranty','serviceability','thermals','seller reliability'],
  ARRAY['parents','students','long-term buyers'],
  ARRAY['trust education','brand guides','buying checklists'],
  ARRAY[]::TEXT[],
  '{"formality":"professional","depth":"intermediate","reassuranceLevel":"medium","technicalDensity":"low"}',
  'Prefer verifiable warranty and service facts; separate brand policy from individual seller and service-center experiences.',
  '["Link claims to official policy where possible","Explain seller versus brand responsibility","Use cautious language"]',
  '["Guarantee service quality","Invent city-level coverage","Generalize anecdotes as facts"]',
  'Write as a LaptopFinder reliability-focused editorial guide. Be evidence-led and never claim to be a real repair professional.',
  '{"allowAffiliateLinks":true,"maxProductCards":2,"requiredDisclosureText":"LaptopFinder may earn a commission through some links. Verify seller, warranty, and return terms before purchase."}',
  '{"canWriteBlogs":true,"canWriteComparisons":true,"canInsertProductCards":true,"canBeAutoScheduled":false,"alwaysRequiresManualReview":true}',
  'LaptopFinder editorial persona — not a real service technician.',
  6, false
)
ON CONFLICT (slug) DO NOTHING;
