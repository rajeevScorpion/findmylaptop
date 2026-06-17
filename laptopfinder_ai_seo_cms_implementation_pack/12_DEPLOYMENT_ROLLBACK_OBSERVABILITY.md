# 12 — Deployment, Rollback, and Observability

## Objective

Deploy safely and make rollback easy.

## Environment variables

Add to environment docs only after checking project conventions.

Possible variables:

```env
OPENAI_API_KEY=
OPENAI_BLOG_WRITER_MODEL=
BLOG_ENABLED=
BLOG_PUBLIC_ENABLED=
AI_BLOG_WRITER_ENABLED=
NEXT_PUBLIC_SITE_URL=
```

Do not put actual secrets in repository.

## Migration deployment

Before production migration:

- Backup database if possible.
- Run migration in preview/staging first.
- Check migration is non-destructive.
- Confirm rollback path.

## Suggested rollout

### Step 1

Deploy with:

```text
blog_enabled=true
blog_public_enabled=false
ai_blog_writer_enabled=false
```

Verify admin manual CMS.

### Step 2

Enable AI only for admin:

```text
ai_blog_writer_enabled=true
```

Generate draft posts but do not publish.

### Step 3

Publish 1–3 reviewed posts.

Enable public blog:

```text
blog_public_enabled=true
```

### Step 4

Monitor:

- build logs
- server errors
- OpenAI API errors
- page rendering errors
- sitemap output
- Search Console indexing later

## Rollback strategy

If public blog causes issue:

```text
blog_public_enabled=false
```

If AI causes issue:

```text
ai_blog_writer_enabled=false
```

If full feature causes issue:

```text
blog_enabled=false
```

This is why feature flags are required.

## Observability

Log:

- AI generation attempts
- AI generation failures
- publish/unpublish events
- schema/sitemap errors
- unknown block render warnings
- product block missing product warnings

Do not log secrets.

## Post-deploy smoke test

- Visit homepage.
- Use laptop finder.
- Login as admin.
- Open admin blog.
- Create draft.
- Generate outline.
- Save draft.
- Preview draft.
- Publish a test post in staging only.
- Confirm public URL.
- Confirm sitemap.
- Disable public blog and confirm post disappears.
- Re-enable and confirm it returns.
