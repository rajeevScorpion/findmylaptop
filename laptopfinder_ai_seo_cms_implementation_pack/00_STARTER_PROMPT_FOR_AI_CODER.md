# Starter Prompt for AI Coder

Use this prompt to start the implementation.

---

You are working on the LaptopFinder.cc codebase.

We need to implement an **AI-assisted SEO blog/CMS system** inside the existing app. The goal is to help admins create SEO-friendly blog posts for Indian laptop buyers, especially students, parents, and professionals.

## Critical instruction: do not assume anything

Before making implementation changes:

1. Inspect the full codebase structure.
2. Identify the framework, routing system, database layer, auth system, UI library, styling approach, deployment assumptions, and existing admin patterns.
3. Ground every change in the existing codebase.
4. Do not invent paths, table names, APIs, auth helpers, or UI conventions without verifying them.
5. If the codebase uses a different stack than expected, adapt to the codebase instead of forcing the plan.
6. Ask clarifying questions if implementation choices are ambiguous or risky.

## Branch and commit workflow

Before implementation:

```bash
git status
git checkout -b feature/ai-seo-blog-cms
```

Commit after meaningful steps. Use clear progressive commit messages such as:

```bash
git commit -m "chore: inspect codebase and document AI SEO CMS integration plan"
git commit -m "feat: add blog content models and migrations"
git commit -m "feat: add admin blog post management screens"
git commit -m "feat: add AI draft generation service"
git commit -m "feat: render SEO blog pages with TOC and metadata"
git commit -m "feat: add admin feature toggles for blog and AI writer"
git commit -m "test: add coverage for blog CMS and AI generation workflow"
```

Do not combine unrelated work into one large commit.

## Safety requirements

- Do not harm existing working features.
- Do not rewrite unrelated modules.
- Do not rename shared components unless necessary.
- Do not modify existing product recommendation logic unless explicitly required.
- Resolve merge conflicts gracefully.
- If there are existing admin pages or CMS structures, integrate with them instead of duplicating patterns.
- Add feature flags/toggles so this feature can be turned off from admin control.
- Never publish AI-generated content automatically.
- Keep all AI-generated output in draft/review state until admin confirms publishing.
- Product facts must come from the database or verified admin input. AI must not invent laptop specs, prices, availability, ratings, or reviews.

## Desired feature

Admin should be able to:

1. Open admin blog dashboard.
2. Create a new AI-assisted blog post.
3. Enter:
   - Topic/subject
   - Optional brief
   - Target audience
   - Primary keyword
   - Secondary keywords
   - Content type/template
   - Include products? yes/no
4. Generate outline.
5. Review/edit outline.
6. Generate full draft.
7. Edit the draft minimally in rich text/block editor.
8. Preview final page.
9. Publish after confirmation.
10. Manage posts later: edit, unpublish, archive, update metadata.

## Required public rendering

The blog page should have:

- SEO-friendly slug
- Metadata
- Open Graph metadata
- Article schema
- FAQ schema where FAQs exist
- Breadcrumb schema
- Table of contents with inner hyperlinks
- Rich text formatting
- Elevated cards
- Modern bullet lists
- Icons from free/open resources already allowed by the project
- Mobile-friendly layout
- Multicolumn layout where appropriate
- Admin provision for future product cards

## First task

Start by reading all markdown files in this implementation pack. Then inspect the codebase and produce a short implementation plan grounded in the actual repository before changing files.

Do not implement until you have completed codebase discovery.
