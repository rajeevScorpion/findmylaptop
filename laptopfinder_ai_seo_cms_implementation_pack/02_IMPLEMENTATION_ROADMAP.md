# 02 — Implementation Roadmap

## Core principle

Build in safe, reversible phases. Each phase should be independently testable and committed.

## Phase 0 — Discovery and branch setup

Tasks:

- Create branch `feature/ai-seo-blog-cms`.
- Inspect codebase.
- Identify existing patterns.
- Confirm database/migration approach.
- Identify admin auth pattern.
- Identify SEO helpers.
- Confirm OpenAI integration approach.
- Document risks.

Acceptance:

- No functional code changed except optional internal notes.
- Implementation choices are grounded in actual codebase.

Suggested commit:

```bash
git commit -m "chore: document AI SEO CMS codebase discovery"
```

## Phase 1 — Feature flags and admin safety gate

Implement feature flags before public/admin UI.

Required flags:

- `blog_enabled`
- `blog_public_enabled`
- `ai_blog_writer_enabled`
- `blog_product_blocks_enabled`
- `blog_schema_enabled`
- `blog_auto_sitemap_enabled`

Preferred behavior:

- If `blog_enabled=false`, admin blog UI is hidden/disabled.
- If `blog_public_enabled=false`, public blog routes return 404 or safe disabled page.
- If `ai_blog_writer_enabled=false`, manual post creation still works.
- If `blog_product_blocks_enabled=false`, product block UI is hidden, but stored content should not crash.
- If `blog_schema_enabled=false`, schema JSON-LD is not rendered.
- If `blog_auto_sitemap_enabled=false`, blog URLs are excluded from sitemap.

Suggested commit:

```bash
git commit -m "feat: add feature flags for AI SEO blog CMS"
```

## Phase 2 — Database/content model

Add content model for posts, tags/categories, versions/logs if feasible.

MVP tables/collections:

- `blog_posts`
- `blog_categories`
- `blog_tags`
- `blog_post_tags`
- `ai_generation_logs`
- optional `blog_post_versions`
- optional `app_feature_flags`

Acceptance:

- Migrations or schema changes are reversible.
- Existing data is not modified destructively.
- Unique slug is enforced.
- Status field exists.
- Published pages only come from `status=published`.

Suggested commit:

```bash
git commit -m "feat: add blog content models and migrations"
```

## Phase 3 — Admin post management

Build admin pages:

- Post list
- Create manual post
- Edit post
- Preview post
- Draft/publish/archive controls
- Metadata editor
- Slug editor
- Category/tag assignment

Acceptance:

- Admin-only access.
- Manual post creation works without AI.
- Status changes are explicit.
- Existing app continues to work.

Suggested commit:

```bash
git commit -m "feat: add admin blog post management"
```

## Phase 4 — AI blog writer service

Add OpenAI integration as server-side only.

Functions:

- Generate outline
- Generate full draft
- Generate metadata
- Improve section
- Generate FAQs
- Generate slug suggestions

Acceptance:

- API key never reaches client.
- AI output saved as draft/review only.
- Responses validated against schema.
- Failure states are visible to admin.
- Logs store metadata, not secrets.

Suggested commit:

```bash
git commit -m "feat: add AI-assisted blog draft generation"
```

## Phase 5 — Rich text/block editor

Use existing editor if available. Otherwise add the smallest stable editor integration.

Preferred:

- TipTap if React/Next stack supports it
- Existing rich text editor if already installed
- Markdown/MDX only if project already uses it or admin is technical

Required blocks:

- Heading
- Paragraph
- Bullets
- Numbered list
- Card
- Info/warning/tip cards
- FAQ block
- CTA block
- TOC source headings
- Placeholder product card block

Acceptance:

- Admin can make minimal edits.
- Content saves reliably.
- Public renderer handles unknown/future blocks gracefully.

Suggested commit:

```bash
git commit -m "feat: add blog editor blocks and content rendering"
```

## Phase 6 — Public blog rendering

Build public pages:

- `/blog`
- `/blog/[slug]`
- category/tag pages only if simple and safe

Required page features:

- Hero section
- Excerpt
- Last updated date
- Reading time
- Sticky/collapsible TOC
- Rich card components
- FAQ accordion/section
- Related posts
- CTA to LaptopFinder tool
- Mobile-first responsive layout

Acceptance:

- Only published posts are public.
- Draft/review/archived posts are not public.
- Disabled feature flag hides route safely.

Suggested commit:

```bash
git commit -m "feat: render public SEO blog pages"
```

## Phase 7 — SEO metadata, sitemap, schema

Implement:

- dynamic title/meta description
- canonical URL
- Open Graph
- Twitter/X card if existing pattern
- Article schema
- FAQ schema
- Breadcrumb schema
- sitemap inclusion
- robots compatibility

Acceptance:

- Metadata is unique per post.
- Slugs are clean.
- Sitemap includes only published blog posts when enabled.
- Schema only uses visible content.

Suggested commit:

```bash
git commit -m "feat: add blog SEO metadata schema and sitemap integration"
```

## Phase 8 — Product card provision

MVP may only store product block placeholders. Full product integration can be later.

Required now:

- Content block type exists for product card/grid.
- Renderer does not break if product ID is missing.
- Admin toggle controls visibility.
- No hallucinated product data is saved from AI.

Suggested commit:

```bash
git commit -m "feat: add future-ready blog product card blocks"
```

## Phase 9 — Testing and hardening

Test:

- Feature flags
- Admin permissions
- AI service errors
- Draft vs published visibility
- Metadata generation
- Sitemap generation
- Slug uniqueness
- Editor save/load
- Mobile rendering
- Build success

Suggested commit:

```bash
git commit -m "test: add AI SEO blog CMS coverage and QA checks"
```

## Phase 10 — Final review

Before merge:

- Run formatter/linter/tests/build.
- Check no unrelated changes.
- Check environment variables documented.
- Check rollback path.
- Provide PR summary.

Suggested commit:

```bash
git commit -m "docs: add AI SEO blog CMS handoff notes"
```
