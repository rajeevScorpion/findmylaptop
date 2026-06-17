# 14 — Commit Plan and Progressive Notes

## Branch

Create a new branch before implementation:

```bash
git checkout -b feature/ai-seo-blog-cms
```

If branch exists:

```bash
git checkout feature/ai-seo-blog-cms
git pull --rebase
```

Resolve conflicts gracefully.

## Commit principles

- Commit after meaningful steps.
- Do not bundle unrelated work.
- Each commit should build on the previous one.
- Keep commit messages clear.
- Include notes in commit body if needed.
- Do not commit secrets or `.env` files.

## Suggested commit sequence

### Commit 1 — Discovery

```bash
git commit -m "chore: document AI SEO CMS codebase discovery"
```

Include:

- codebase discovery notes
- implementation plan
- unresolved questions

### Commit 2 — Feature flags

```bash
git commit -m "feat: add feature flags for AI SEO blog CMS"
```

Include:

- feature flag model/service
- admin toggle UI if simple
- safe disabled behavior

### Commit 3 — Content model

```bash
git commit -m "feat: add blog content models and migrations"
```

Include:

- posts
- tags/categories if included
- generation logs
- migration docs

### Commit 4 — Admin post management

```bash
git commit -m "feat: add admin blog post management screens"
```

Include:

- list
- create
- edit
- status change
- preview route if ready

### Commit 5 — AI service

```bash
git commit -m "feat: add AI blog outline and draft generation"
```

Include:

- OpenAI server-side service
- route/action
- validation
- logs
- error states

### Commit 6 — Editor and blocks

```bash
git commit -m "feat: add blog editor blocks and admin preview"
```

Include:

- rich text/block editor
- card blocks
- FAQ block
- CTA block
- product placeholder block

### Commit 7 — Public rendering

```bash
git commit -m "feat: render public blog index and post pages"
```

Include:

- `/blog`
- `/blog/[slug]`
- TOC
- cards
- related posts
- responsive layout

### Commit 8 — SEO

```bash
git commit -m "feat: add blog metadata schema and sitemap support"
```

Include:

- metadata
- canonical
- Open Graph
- schema
- sitemap

### Commit 9 — Tests

```bash
git commit -m "test: cover AI SEO blog CMS flows"
```

Include:

- unit/integration tests
- manual QA docs if automated tests not available

### Commit 10 — Final docs

```bash
git commit -m "docs: add AI SEO CMS rollout and rollback notes"
```

Include:

- env docs
- rollout
- rollback
- limitations

## Conflict resolution

If conflicts occur:

1. Stop and inspect both sides.
2. Preserve existing working behavior.
3. Prefer integrating with current patterns.
4. Do not overwrite unrelated work.
5. Run tests/build after resolving.
6. Note conflict resolution in progress notes.

## Progress notes format

Use this after each phase:

```md
## Progress note

Phase completed:
Files changed:
Why this approach matches the existing codebase:
Feature flags affected:
Tests run:
Risks/known limitations:
Next step:
```

## Final PR summary format

```md
## Summary

Implemented AI-assisted SEO blog CMS for LaptopFinder.

## What changed

- Added blog content model
- Added admin blog management
- Added AI outline/draft generation
- Added public blog rendering
- Added SEO metadata/schema/sitemap
- Added feature flags/admin controls

## Safety

- AI output is draft/review only
- Admin confirmation required to publish
- Product facts are not invented by AI
- Feature flags can disable public blog and AI writer

## Tests

- [ ] lint
- [ ] typecheck
- [ ] test
- [ ] build
- [ ] manual admin QA
- [ ] manual public blog QA

## Rollback

Disable:
- `ai_blog_writer_enabled`
- `blog_public_enabled`
- `blog_enabled`
```
