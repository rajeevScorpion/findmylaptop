# 11 — Testing, QA, and Acceptance Criteria

## Objective

Verify the CMS works safely without breaking existing LaptopFinder functionality.

## Required checks before final handoff

Run the project’s existing commands. Do not invent commands. Inspect `package.json`.

Common examples:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

or equivalent.

## Test matrix

### Feature flags

Test:

- `blog_enabled=true/false`
- `blog_public_enabled=true/false`
- `ai_blog_writer_enabled=true/false`
- `blog_product_blocks_enabled=true/false`
- `blog_schema_enabled=true/false`
- `blog_auto_sitemap_enabled=true/false`

Acceptance:

- Disabled features do not crash.
- Public blog can be safely hidden.
- AI can be disabled while manual CMS still works.

### Admin permissions

Test:

- Non-admin cannot access admin blog pages.
- Non-admin cannot call AI generation endpoints.
- Admin can create/edit/publish posts.
- Admin must confirm publish.

### Post lifecycle

Test:

```text
create draft
save draft
edit draft
generate outline
generate draft
preview
publish
unpublish
archive
restore if supported
```

Acceptance:

- Only published posts show publicly.
- Drafts do not appear in blog index or sitemap.

### Slug handling

Test:

- unique slug
- duplicate slug rejected or auto-resolved
- slug is stable after publish
- changing published slug requires confirmation

### AI generation

Test:

- valid topic generates outline
- valid topic generates draft
- invalid/empty topic shows validation error
- API failure shows friendly error
- malformed model response is rejected
- AI output remains draft/review

### Editor

Test:

- headings save/load
- lists save/load
- cards save/load
- FAQ save/load
- CTA save/load
- product placeholder save/load
- unknown block does not crash renderer

### Public page rendering

Test:

- `/blog` loads
- `/blog/[slug]` loads for published post
- draft post returns 404 or admin-only preview
- TOC anchors work
- mobile layout works
- CTA link works
- related posts do not crash if none exist

### SEO

Test:

- title and meta description render
- canonical URL renders
- Open Graph renders
- Article schema valid
- FAQ schema only when visible FAQs exist
- Breadcrumb schema renders
- sitemap includes only published posts
- disabled sitemap flag excludes blog URLs

### Product block provision

Test:

- placeholder renders safely
- feature flag hides product block
- missing product ID does not crash
- no Product schema emitted for placeholders

## Regression testing

Check existing flows:

- homepage
- laptop finder flow
- product listing/product cards
- auth/login
- admin dashboard
- existing API routes
- build/deploy

## Manual QA checklist

- Create one course buying guide post.
- Create one budget guide post.
- Create one comparison guide post.
- Confirm each looks good on mobile and desktop.
- Confirm SEO preview looks reasonable.
- Confirm AI does not create fake laptop prices/specs.

## Acceptance criteria

MVP is acceptable only when:

- Admin can create and publish a manual post.
- Admin can generate AI outline and draft.
- AI output requires human confirmation.
- Blog public page renders with TOC and rich cards.
- Metadata/schema/sitemap work.
- Feature flags work.
- Existing app functionality remains intact.
- Build passes.
