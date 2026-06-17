# 05 — Admin CMS UI Spec

## Objective

Build admin pages for managing blog posts and AI-assisted draft creation.

## Mandatory rule

Use the existing admin layout, auth guard, UI components, buttons, forms, modals, toasts, and styling patterns. Do not create a separate visual system unless none exists.

## Required screens

### 1. Admin blog dashboard

Suggested route, adapt to codebase:

```text
/admin/blog
```

Features:

- List posts
- Search/filter by title, status, category, keyword
- Status badges
- SEO score indicator
- Last updated
- Published URL
- Actions:
  - Edit
  - Preview
  - Publish/unpublish
  - Archive
  - Duplicate

Columns:

```text
Title
Status
Primary keyword
Category
Updated
Published
Actions
```

### 2. Create post

Suggested route:

```text
/admin/blog/new
```

Creation modes:

- Manual post
- AI-assisted post

Manual fields:

```text
Title
Slug
Excerpt
Content
Category
Tags
Meta title
Meta description
Status
```

AI-assisted fields:

```text
Topic/subject
Optional brief
Target audience
Primary keyword
Secondary keywords
Content type/template
Target word count
Include product placeholders?
Tone
```

Content templates:

```text
course_buying_guide
budget_buying_guide
use_case_guide
comparison_guide
parent_friendly_explainer
product_roundup_placeholder
spec_explainer
```

### 3. AI generation panel

Actions:

```text
Generate outline
Regenerate outline
Generate full draft
Improve selected section
Generate FAQs
Generate metadata
```

Important:

- Always show preview before saving AI output over existing content.
- If replacing content, ask for confirmation.
- Keep existing manually edited content safe.

### 4. Post editor

Recommended layout:

```text
Top bar:
- Back
- Save draft
- Preview
- Publish
- Status badge

Main:
- Editor

Right side panel:
- SEO
- Slug
- Category/tags
- Feature image/OG image
- Product block suggestions
- Schema preview
- Publish settings
```

### 5. Preview mode

Admin preview must show:

- Public page layout
- Metadata preview
- Mobile preview if easy
- Warning if feature flag disables public blog
- Warning if post is not published

Suggested preview route:

```text
/admin/blog/[id]/preview
```

or use existing preview pattern.

## Editor requirements

Editor must support:

- H2/H3 headings
- Paragraphs
- Bold/italic/links
- Bulleted lists
- Numbered lists
- Modern styled lists
- Elevated cards
- Info/warning/tip cards
- FAQ block
- CTA block
- Product placeholder block
- TOC generation from headings

## Minimal editing

The user requested minimal admin editing. So avoid making the admin experience too technical.

Admin should not need to write JSON.

## UX details

### AI draft creation flow

1. Admin enters topic and brief.
2. Clicks `Generate outline`.
3. App displays outline with section cards.
4. Admin can edit outline text.
5. Clicks `Generate draft`.
6. Draft appears in editor.
7. Admin reviews/edits.
8. SEO panel shows metadata.
9. Admin clicks `Preview`.
10. Admin clicks `Publish` after confirmation.

### Confirmation requirements

Require confirmation for:

- Publishing
- Unpublishing
- Archiving
- Overwriting existing content with AI output
- Changing slug of published post

## Admin feature toggles screen

If no settings page exists, add a simple admin settings section.

Suggested route:

```text
/admin/settings/features
```

Toggles:

- Blog CMS enabled
- Public blog enabled
- AI blog writer enabled
- Blog schema enabled
- Blog product blocks enabled
- Blog sitemap inclusion enabled

Each toggle should have helper text explaining impact.

## Empty states

Posts list empty state:

```text
No blog posts yet. Create a manual post or generate an AI-assisted draft.
```

AI disabled state:

```text
AI blog writer is currently disabled. You can still create and edit posts manually.
```

Public blog disabled state:

```text
Public blog is disabled by admin settings. Published posts are saved but not visible publicly.
```

## Do not break existing admin

- Do not modify unrelated admin navigation destructively.
- Add blog nav item only if `blog_enabled=true`.
- If admin nav is static, add safely following existing pattern.
