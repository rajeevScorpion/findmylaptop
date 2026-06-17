# 16 — MVP User Stories

## Admin creates a manual blog post

As an admin, I want to create a blog post manually so that I can publish content even when AI is disabled.

Acceptance:

- Admin can enter title, slug, excerpt, content, category/tags, metadata.
- Post saves as draft.
- Admin can preview.
- Admin can publish after confirmation.

## Admin generates an AI outline

As an admin, I want to enter a topic and get an outline so that I can review the structure before generating full content.

Acceptance:

- Admin enters topic/brief/keywords/audience/template.
- AI returns structured outline.
- Admin can edit or regenerate outline.
- Outline does not publish anything.

## Admin generates an AI draft

As an admin, I want to generate a full draft from the reviewed outline so that I can save time writing SEO content.

Acceptance:

- AI generates structured content.
- Content appears in editor.
- Post status is draft/review.
- Admin can edit.
- AI does not invent product facts.
- Product blocks are placeholders unless grounded data is provided.

## Admin publishes a post

As an admin, I want to publish a reviewed post so that users and search engines can access it.

Acceptance:

- Publish requires explicit confirmation.
- Only published posts appear on `/blog`.
- Published post appears in sitemap if sitemap flag is enabled.
- Metadata and schema render.

## Admin disables public blog

As an admin, I want to disable public blog visibility so that we can deploy safely before launching.

Acceptance:

- Published posts remain in database.
- Public users cannot access blog pages.
- Sitemap excludes blog URLs.
- Admin can still edit posts if blog CMS is enabled.

## Admin disables AI writer

As an admin, I want to disable AI generation so that I can control API usage and cost.

Acceptance:

- AI buttons disappear or show disabled state.
- Manual CMS still works.
- Existing drafts remain editable.

## User reads a blog guide

As a user, I want to read a clear laptop buying guide so that I can understand what laptop to buy.

Acceptance:

- Page loads fast.
- TOC works.
- Content is readable on mobile.
- Cards and lists make advice easy to scan.
- CTA points to LaptopFinder.

## Future admin inserts product cards

As an admin, I want to place product card blocks in posts so that blog guides can connect to actual LaptopFinder listings.

Acceptance:

- Placeholder blocks exist in MVP.
- Future blocks can reference product IDs.
- Missing products do not break public page.
