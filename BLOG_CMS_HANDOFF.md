# AI SEO Blog/CMS — Handoff & Rollout Notes

Branch: `feature/ai-seo-blog-cms`. The feature is fully gated behind feature
flags and ships no destructive DB changes. Migrations are applied **manually**.

## 1. Apply migrations (manual, in order)

Run these in the Supabase SQL editor (or `psql`) against the target database.
See [supabase/migrations/README.md](supabase/migrations/README.md) for details
and the matching rollback scripts.

1. `supabase/migrations/011_create_blog.sql`
2. `supabase/migrations/012_blog_rls.sql`
3. `supabase/migrations/013_seed_blog_flags.sql`

All three are additive — no existing table is dropped, renamed, or altered. The
`handle_updated_at()` trigger function (created in `002`) is reused, not
recreated destructively.

## 2. Environment

No new required vars. Optional:

```env
OPENAI_BLOG_WRITER_MODEL=gpt-4o-mini   # defaults to gpt-4o-mini
```

The AI writer reuses the existing `OPENAI_API_KEY`.

## 3. Feature flags (Admin → Settings → "Blog & AI")

Stored as rows in the existing `settings` table. Seeded defaults:

| Flag | Default | Effect when off |
|------|---------|-----------------|
| `blog_enabled` | true | Hides admin Blog nav + disables admin blog routes |
| `blog_public_enabled` | **false** | `/blog` and `/blog/[slug]` return 404 |
| `ai_blog_writer_enabled` | **false** | AI panel hidden; manual authoring still works |
| `blog_product_blocks_enabled` | false | Product-card blocks hidden in editor + public |
| `blog_schema_enabled` | true | No JSON-LD on posts |
| `blog_auto_sitemap_enabled` | true | Blog URLs excluded from `/sitemap.xml` |

Recommended rollout: keep `blog_public_enabled` and `ai_blog_writer_enabled`
**off** until the OpenAI key is confirmed and the first post is reviewed.

## 4. Authoring flow

Admin → Blog → New post. Author manually or use **AI assist**
(Outline / Draft / FAQs / Metadata). AI output lands as `ai_generated` status —
never auto-published. Set status to `published` to make it public. The block
editor supports headings, paragraphs, bullet/numbered lists, cards, callouts,
FAQ, CTA, and a future-ready product-card placeholder.

## 5. Safety properties

- AI output is draft/review only; publishing is an explicit admin action.
- The AI system prompt forbids inventing specs/prices/ratings; with no grounded
  product data it emits placeholder blocks only.
- `ai_generation_logs` stores metadata only (model, tokens, status) — never keys.
- Public renderer ignores unknown/future blocks gracefully.
- The flag helper defaults public features OFF if the settings read fails.

## 6. Rollback

Fastest (no DB change): turn off `blog_public_enabled`, `ai_blog_writer_enabled`,
and `blog_enabled` in Admin → Settings.

Full teardown: run the rollback scripts in reverse order
(`013_…_rollback.sql` → `012_…_rollback.sql` → `011_…_rollback.sql`).

## 7. Verification

- `npm run build` — passes (all blog/admin/sitemap routes compile).
- Manual: see the "Verification" section of the plan / step list below.
  1. Apply migrations on staging; confirm existing tables untouched.
  2. Toggle flags; confirm nav/AI/public visibility behavior.
  3. Create manual post → publish → `/blog` + `/blog/[slug]` render; drafts 404.
  4. AI generate (key set) → output is `ai_generated`, log row written w/o secrets.
  5. Check `/sitemap.xml` includes published posts + laptops, excludes drafts.
  6. Check JSON-LD only renders when `blog_schema_enabled`.
