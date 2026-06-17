# 15 — Final Handoff Checklist

Before delivering implementation, confirm every item below.

## Codebase safety

- [ ] New branch created before implementation.
- [ ] No unrelated files changed.
- [ ] Existing LaptopFinder flow still works.
- [ ] Existing product logic still works.
- [ ] Existing admin/auth logic still works.
- [ ] No secrets committed.
- [ ] Conflicts resolved carefully.

## Feature flags/admin controls

- [ ] `blog_enabled`
- [ ] `blog_public_enabled`
- [ ] `ai_blog_writer_enabled`
- [ ] `blog_product_blocks_enabled`
- [ ] `blog_schema_enabled`
- [ ] `blog_auto_sitemap_enabled`
- [ ] Admin can toggle features or env fallback is documented.
- [ ] Disabled flags do not crash app.

## Admin CMS

- [ ] Admin post list exists.
- [ ] Admin can create manual post.
- [ ] Admin can generate AI outline.
- [ ] Admin can generate AI draft.
- [ ] Admin can edit content.
- [ ] Admin can edit slug/meta.
- [ ] Admin can preview.
- [ ] Admin can publish/unpublish/archive.
- [ ] AI output does not auto-publish.

## AI writer

- [ ] Uses server-side OpenAI key.
- [ ] Key is not exposed to client.
- [ ] Output is structured/validated.
- [ ] AI cannot invent product facts.
- [ ] Product placeholders are used when product data is not provided.
- [ ] Errors are handled gracefully.
- [ ] Generation logs are safe.
- [ ] Prompt version is stored.

## Public blog

- [ ] `/blog` works when enabled.
- [ ] `/blog/[slug]` works for published posts.
- [ ] Draft/review posts are not public.
- [ ] TOC anchors work.
- [ ] Rich cards render.
- [ ] FAQ block renders.
- [ ] CTA block renders.
- [ ] Mobile layout works.
- [ ] Unknown blocks do not crash.

## SEO

- [ ] Unique title/meta per post.
- [ ] Canonical URL.
- [ ] Open Graph metadata.
- [ ] Article schema.
- [ ] FAQ schema only for visible FAQs.
- [ ] Breadcrumb schema.
- [ ] Dynamic sitemap includes only published posts.
- [ ] Sitemap controlled by feature flag.
- [ ] Blog pages are indexable only when public blog is enabled.

## Product card provision

- [ ] Product placeholder block exists.
- [ ] Product blocks can be toggled off.
- [ ] Missing product data does not crash.
- [ ] No fake product schema.

## Testing

- [ ] Lint passes or known issues documented.
- [ ] Typecheck passes or known issues documented.
- [ ] Tests pass or known issues documented.
- [ ] Build passes.
- [ ] Manual QA completed.

## Documentation

- [ ] Env vars documented.
- [ ] Rollout steps documented.
- [ ] Rollback steps documented.
- [ ] Known limitations documented.
- [ ] Clarifying questions listed if unresolved.

## Final delivery note

The implementation should be delivered with a concise summary:

```md
Implemented AI-assisted SEO blog CMS.

AI drafts are generated but never auto-published. Admin can review, edit, and publish. Public blog and AI writer are controlled by feature flags. Product cards are provisioned as safe placeholders so future product listing integration can be added without AI inventing product details.
```
