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
| 4 | `014_seed_blog_categories.sql` | Seeds 7 starter categories into `blog_categories` (`ON CONFLICT (slug) DO NOTHING`). |
| 5 | `015_add_ai_inputs.sql` | Adds a nullable `ai_inputs JSONB` column to `blog_posts` (additive). |

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
015_add_ai_inputs_rollback.sql        -- drops only the ai_inputs column
014_seed_blog_categories_rollback.sql -- deletes only the 7 seeded categories
013_seed_blog_flags_rollback.sql      -- deletes only the 6 flag keys
012_blog_rls_rollback.sql             -- drops only the blog RLS policies
011_create_blog_rollback.sql          -- drops only the 5 blog tables
```

`011_create_blog_rollback.sql` intentionally does **not** drop
`public.handle_updated_at()` — that function is shared with the pre-existing
`laptops` table.

## Autonomous growth-agent migrations (024–033)

These migrations are not applied automatically. Apply them to staging in this
exact order:

```text
024_create_agent_foundations.sql
025_create_product_research.sql
026_create_research_calendar.sql
027_add_blog_personas.sql
028_create_chip_learning.sql
029_create_blog_agent_metadata.sql
030_create_affiliate_click_events.sql
031_harden_chat_and_blog_access.sql
032_harden_catalog_and_taxonomy_access.sql
033_add_research_novelty.sql
```

Migration 033 is required by the deterministic Research Calendar novelty code.
It adds calendar policy fields, packet novelty audit fields, typed no-topic
reasons, permanent exact-title claims, and the global novelty lease that
serializes history loading through packet persistence. Deploy compatible
preview code with the Research Agent disabled, confirm migration 032 is already
present, and then run `033_add_research_novelty.sql` manually against staging.
No application deployment or environment variable applies this migration.

Rollback is destructive and must be run in exact reverse order:

```text
033_add_research_novelty_rollback.sql
032_harden_catalog_and_taxonomy_access_rollback.sql
031_harden_chat_and_blog_access_rollback.sql
030_create_affiliate_click_events_rollback.sql
029_create_blog_agent_metadata_rollback.sql
028_create_chip_learning_rollback.sql
027_add_blog_personas_rollback.sql
026_create_research_calendar_rollback.sql
025_create_product_research_rollback.sql
024_create_agent_foundations_rollback.sql
```

Before running `033_add_research_novelty_rollback.sql`, stop Research Calendar
work and deploy code that no longer reads migration-033 fields or calls its
functions. Run the 033 rollback manually before rollback 032. It removes the
novelty metadata, exact-title claims, and global lease and restores the earlier
research persistence/completion functions. Never apply a staging or production
forward/rollback migration without the required explicit approval.

See `docs/AUTONOMOUS_AGENTS_RUNBOOK.md` for environment setup, staged
activation, safety checks, and rollback preparation.
