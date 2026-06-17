# 17 — Route and API Contracts

## Important

These are suggested contracts. Adapt to the actual routing/API style used by the codebase.

## Public routes

```text
GET /blog
GET /blog/[slug]
```

Optional:

```text
GET /blog/category/[slug]
GET /blog/tag/[slug]
```

## Admin routes

```text
GET /admin/blog
GET /admin/blog/new
GET /admin/blog/[id]
GET /admin/blog/[id]/preview
GET /admin/settings/features
```

## API routes or server actions

Use route handlers/server actions according to existing project style.

Suggested API routes:

```text
POST /api/admin/blog/posts
GET /api/admin/blog/posts
GET /api/admin/blog/posts/[id]
PATCH /api/admin/blog/posts/[id]
DELETE /api/admin/blog/posts/[id]
POST /api/admin/blog/posts/[id]/publish
POST /api/admin/blog/posts/[id]/unpublish
POST /api/admin/blog/posts/[id]/archive
POST /api/admin/blog/ai/outline
POST /api/admin/blog/ai/draft
POST /api/admin/blog/ai/metadata
POST /api/admin/blog/ai/improve-section
GET /api/admin/features
PATCH /api/admin/features
```

## Admin AI outline request

```json
{
  "topic": "Best laptop for B.Tech CSE students under ₹60,000",
  "brief": "Simple guide for students and parents.",
  "primaryKeyword": "best laptop for B.Tech CSE students",
  "secondaryKeywords": ["laptop for coding students", "laptop under 60000"],
  "audience": ["students", "parents"],
  "templateType": "course_buying_guide",
  "targetWordCount": 1500,
  "includeProductPlaceholders": true
}
```

## Admin AI outline response

```json
{
  "ok": true,
  "outline": {},
  "logId": "..."
}
```

Error response:

```json
{
  "ok": false,
  "error": {
    "code": "AI_WRITER_DISABLED",
    "message": "AI blog writer is disabled by admin settings."
  }
}
```

## Admin AI draft request

```json
{
  "outline": {},
  "topic": "...",
  "brief": "...",
  "primaryKeyword": "...",
  "secondaryKeywords": [],
  "audience": [],
  "templateType": "course_buying_guide",
  "includeProductPlaceholders": true
}
```

## Post create request

```json
{
  "title": "string",
  "slug": "string",
  "excerpt": "string",
  "contentJson": {},
  "status": "draft",
  "metaTitle": "string",
  "metaDescription": "string",
  "primaryKeyword": "string",
  "secondaryKeywords": ["string"],
  "categoryId": "optional",
  "tagIds": []
}
```

## Post publish request

```json
{
  "confirm": true
}
```

## Feature flags response

```json
{
  "blog_enabled": true,
  "blog_public_enabled": false,
  "ai_blog_writer_enabled": false,
  "blog_product_blocks_enabled": false,
  "blog_schema_enabled": true,
  "blog_auto_sitemap_enabled": true
}
```

## Validation

Every write API/server action must validate:

- admin auth
- CSRF/session pattern if applicable
- input shape
- status enum
- slug uniqueness
- content shape
- feature flag availability

## HTTP behavior

- Unauthorized: 401 or redirect based on existing convention.
- Forbidden non-admin: 403.
- Missing post: 404.
- Draft public access: 404.
- AI disabled: 403 or 409 with friendly message.
- Validation error: 400 with field details.
