# Supabase migrations

SQL migrations are applied **manually** (run in order against the Supabase SQL
editor or via `psql`). The database is shared with production, so every blog/CMS
migration is **additive** and ships with a paired `*_rollback.sql`.

## Blog / AI SEO CMS migrations (011–013)

Run in this order:

| Step | File | What it does |
|------|------|--------------|
| 1 | `011_create_blog.sql` | Creates `blog_posts`, `blog_categories`, `blog_tags`, `blog_post_tags`, `ai_generation_logs`. Reuses the existing `handle_updated_at()` trigger. Touches no existing table. |
| 2 | `012_blog_rls.sql` | Enables RLS + policies (anon reads only `status='published'`; authenticated reads all). Mirrors `005_rls_policies.sql`. |
| 3 | `013_seed_blog_flags.sql` | Seeds 6 feature-flag rows into the existing `settings` table (`ON CONFLICT DO NOTHING`). |

### Defaults seeded

```
blog_enabled=true
blog_public_enabled=false        # turn on after first content is reviewed
ai_blog_writer_enabled=false     # turn on after confirming OPENAI_API_KEY
blog_product_blocks_enabled=false
blog_schema_enabled=true
blog_auto_sitemap_enabled=true
```

## Rollback

Run the rollbacks in **reverse** order:

```
013_seed_blog_flags_rollback.sql   -- deletes only the 6 flag keys
012_blog_rls_rollback.sql          -- drops only the blog RLS policies
011_create_blog_rollback.sql       -- drops only the 5 blog tables
```

`011_create_blog_rollback.sql` intentionally does **not** drop
`public.handle_updated_at()` — that function is shared with the pre-existing
`laptops` table.
