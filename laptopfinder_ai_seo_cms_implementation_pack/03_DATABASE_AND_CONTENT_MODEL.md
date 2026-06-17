# 03 — Database and Content Model

## Important instruction

Adapt this schema to the actual database layer. Do not blindly create Prisma/SQL files if the project uses something else.

## Content source of truth

Prefer storing article content as structured JSON/block JSON.

Suggested fields:

- `content_json`: source of truth for editor
- `content_html`: optional rendered/cache output
- `toc_json`: generated TOC
- `schema_json`: generated JSON-LD or source fields used to generate it

Avoid storing only raw HTML if the app needs future product cards and structured blocks.

## Blog post statuses

Use explicit statuses:

```text
draft
ai_generated
review
published
archived
```

Rules:

- AI output starts as `ai_generated` or `draft`.
- Public route only shows `published`.
- Archived posts should not show in index/sitemap.
- Unpublished posts should either return 404 or require admin preview token.

## Suggested `blog_posts` fields

```text
id
title
slug
excerpt
content_json
content_html
status
template_type
audience
primary_keyword
secondary_keywords
meta_title
meta_description
canonical_url
og_title
og_description
og_image_url
schema_json
toc_json
reading_time_minutes
author_id
created_by
updated_by
published_at
created_at
updated_at
last_reviewed_at
needs_update_at
```

## Suggested `blog_categories`

```text
id
name
slug
description
created_at
updated_at
```

## Suggested `blog_tags`

```text
id
name
slug
created_at
updated_at
```

## Suggested `blog_post_tags`

```text
post_id
tag_id
```

## Suggested `blog_post_versions`

Useful but optional for MVP.

```text
id
post_id
version_number
title
content_json
meta_title
meta_description
changed_by
change_note
created_at
```

## Suggested `ai_generation_logs`

```text
id
post_id
generation_type
model
prompt_version
input_topic
input_brief
input_keywords
output_status
error_message
tokens_input
tokens_output
tokens_cached
cost_estimate
created_by
created_at
```

Do not store API keys, full secrets, or sensitive environment data.

## Suggested `app_feature_flags`

Only create this if no existing feature flag/admin setting system exists.

```text
id
key
value_boolean
description
updated_by
updated_at
created_at
```

Suggested flags:

```text
blog_enabled
blog_public_enabled
ai_blog_writer_enabled
blog_product_blocks_enabled
blog_schema_enabled
blog_auto_sitemap_enabled
```

## Slug rules

- Lowercase
- Hyphen-separated
- Remove punctuation
- Avoid duplicate slugs
- Avoid date-only slugs
- Prefer human-readable SEO slug
- Do not change slug automatically after publishing unless admin confirms

Example:

```text
best-laptop-for-btech-cse-students-under-60000
```

## Migration safety

Before migration:

```bash
git status
```

Migration requirements:

- Do not drop existing tables.
- Do not rename existing columns without review.
- Do not alter existing product tables unless required.
- Add nullable columns first if modifying existing tables.
- Provide rollback notes.
- Test migration locally before deploy.

## Content JSON block model

Suggested block shape:

```json
{
  "type": "doc",
  "blocks": [
    {
      "type": "hero",
      "data": {
        "title": "Best Laptop for B.Tech CSE Students",
        "excerpt": "A simple guide for Indian students and parents."
      }
    },
    {
      "type": "heading",
      "level": 2,
      "text": "Quick answer",
      "id": "quick-answer"
    },
    {
      "type": "card",
      "variant": "quick_answer",
      "icon": "Laptop",
      "content": "For most B.Tech CSE students, choose at least 16GB RAM and 512GB SSD if budget allows."
    },
    {
      "type": "paragraph",
      "text": "..."
    },
    {
      "type": "faq",
      "items": [
        {
          "question": "Is 8GB RAM enough for coding?",
          "answer": "It can work for basic coding, but 16GB is better for four years of college."
        }
      ]
    },
    {
      "type": "cta",
      "variant": "finder",
      "title": "Still confused?",
      "body": "Use LaptopFinder to get a personalized shortlist.",
      "href": "/"
    },
    {
      "type": "product_grid_placeholder",
      "data": {
        "filterIntent": "coding_under_60000",
        "limit": 4
      }
    }
  ]
}
```

## Unknown blocks

Public renderer must handle unknown blocks gracefully:

- Do not crash.
- Render a safe placeholder in admin preview.
- Hide unknown blocks on public page if necessary.
