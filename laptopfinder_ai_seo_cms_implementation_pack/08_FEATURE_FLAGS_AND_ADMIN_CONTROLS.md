# 08 — Feature Flags and Admin Controls

## Objective

Allow admin to toggle the blog/CMS/AI features on or off safely.

## Required feature flags

```text
blog_enabled
blog_public_enabled
ai_blog_writer_enabled
blog_product_blocks_enabled
blog_schema_enabled
blog_auto_sitemap_enabled
```

## Optional feature flags

```text
blog_comments_enabled
blog_related_posts_enabled
blog_ai_metadata_enabled
blog_ai_outline_enabled
blog_ai_section_rewrite_enabled
blog_preview_enabled
```

## Behavior matrix

| Flag | Enabled behavior | Disabled behavior |
|---|---|---|
| `blog_enabled` | Blog CMS exists | Hide admin blog nav and disable blog routes |
| `blog_public_enabled` | Published posts visible | Public blog routes return 404/disabled state |
| `ai_blog_writer_enabled` | AI generation buttons visible | Manual post creation only |
| `blog_product_blocks_enabled` | Product blocks render | Hide product block UI and render safe fallback |
| `blog_schema_enabled` | JSON-LD renders | Do not render blog schema |
| `blog_auto_sitemap_enabled` | Blog posts included in sitemap | Exclude blog posts from sitemap |

## Admin UI

Create or extend a feature settings page.

Each flag should have:

- Label
- Toggle
- Description
- Last updated
- Updated by, if available

Example helper copy:

```text
AI Blog Writer: Allows admins to generate outlines, drafts, FAQs, and metadata using OpenAI. AI content still requires manual review before publishing.
```

```text
Public Blog: Controls whether published blog posts are visible to users and search engines.
```

## Defaults

Recommended MVP defaults:

```text
blog_enabled=true
blog_public_enabled=false until first content is reviewed
ai_blog_writer_enabled=false until OpenAI key is configured
blog_product_blocks_enabled=false
blog_schema_enabled=true
blog_auto_sitemap_enabled=true
```

However, adapt defaults to deployment safety needs.

## Environment fallback

If database feature flags are unavailable, support env fallback:

```env
BLOG_ENABLED=true
BLOG_PUBLIC_ENABLED=false
AI_BLOG_WRITER_ENABLED=false
```

But admin control is preferred.

## Safe failure

If feature flag lookup fails:

- Admin can see an error.
- Public blog should default to safe disabled state.
- Existing app should continue working.

## Testing feature flags

Test every flag individually.

Scenarios:

- Blog admin disabled
- Public blog disabled
- AI writer disabled
- Product blocks disabled
- Schema disabled
- Sitemap disabled

No disabled flag should crash the app.
