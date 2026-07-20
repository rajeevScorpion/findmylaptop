# Autonomous growth agents runbook

This runbook covers the review-only MVP on the
`laptopfinder_autonomous_agents_prompt_pack` branch. It does not authorize a
production deployment, a `master` merge, or database execution.

## Safety state after installation

- The global emergency stop and pause controls are available to admins.
- Research, blogging, Chip learning, and affiliate monetization start disabled.
- Safe mode starts enabled. Outbound product links resolve to an approved
  canonical destination rather than a monetized destination while it is on.
- The research calendar is disabled and paused.
- Scheduled automatic draft caps start at zero.
- Research can create evidence packets; blogging can create only
  `ai_generated` CMS drafts. Neither workflow publishes content.
- Manual/Amazon candidate promotion creates an unpublished laptop for existing
  admin review. Flipkart stays disabled until credentials pass a health check.

## Preview environment

Configure these as server-side secrets or settings in the staging project:

```text
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
ADMIN_EMAILS
CRON_SECRET (Vercel) or AGENT_CRON_SECRET (another approved scheduler)
AMAZON_CREATORS_CLIENT_ID
AMAZON_CREATORS_CLIENT_SECRET
AMAZON_PARTNER_TAG
```

Optional routing/configuration:

```text
LLM_MODEL_RESEARCH=gpt-5.6-terra
LLM_MODEL_BLOGGING=gpt-5.6-luna
LLM_MODEL_CHIP=gpt-5.6-luna
LLM_MODEL_EXTRACTION=gpt-5.6-luna
LLM_MODEL_TRANSCRIPTION=gpt-4o-mini-transcribe
RESEARCH_ALLOWED_DOMAINS=
FLIPKART_AFFILIATE_ENABLED=false
FLIPKART_AFFILIATE_ID=
FLIPKART_AFFILIATE_TOKEN=
```

Do not expose service-role, OpenAI, marketplace, or cron credentials through a
`NEXT_PUBLIC_` variable.

## Forward migrations

The user applies migrations manually. Deploy the compatible branch to staging
with every capability still off, then run each file separately in this exact
order against the staging Supabase project:

1. `024_create_agent_foundations.sql`
2. `025_create_product_research.sql`
3. `026_create_research_calendar.sql`
4. `027_add_blog_personas.sql`
5. `028_create_chip_learning.sql`
6. `029_create_blog_agent_metadata.sql`
7. `030_create_affiliate_click_events.sql`
8. `031_harden_chat_and_blog_access.sql`
9. `032_harden_catalog_and_taxonomy_access.sql`

Do not continue after an error. Record the failing statement and inspect the
database state before retrying.

## Preview activation sequence

1. Confirm the branch is deployed to the staging project and all agent flags are off.
2. Confirm an allowlisted admin can open **Admin > Growth Agents**.
3. Validate source health. Keep Flipkart and any unverified source disabled.
4. Test a manual product candidate, then reject or promote it. Promotion must
   create an unpublished laptop only.
5. Enable the Research Agent, keep the calendar paused, and use **Run now** on
   one day. Inspect its source references and confidence before handoff.
6. Enable the Blogging Agent and generate one review draft. Confirm its CMS
   status is `ai_generated`, persona disclosure is visible, and it is not on a
   public blog route.
7. Enable Chip learning only after checking the privacy notice and 90-day
   staging retention behavior. Confirm chat still works if learning writes fail.
8. Test `/api/out` from product cards with safe mode on. It must reject invalid
   placement/identifier values, never accept a destination URL from the browser,
   and never redirect outside the server allowlist.
9. Add platform/WAF rate limits for `/api/chat`, `/api/transcribe`, and
   `/api/out`, then verify normal traffic and abusive bursts in preview. Do not
   enable paid public AI endpoints without this perimeter control.
10. Only after those checks, decide whether to turn safe mode off and enable
   affiliate links/source public-display flags in staging.
11. Unpause/enable the research calendar only after cron authentication is
    tested. The included schedule polls once daily at 03:30 UTC (09:00 IST).

The database stores schedule times, but the bundled once-daily Vercel cron can
only honor the daily poll window. More precise or multiple daily run times need
an approved scheduler cadence. Cron delivery can be duplicated, so database
idempotency and job locks remain the execution boundary.

## Operational controls

- **Emergency stop:** stops new growth-agent work immediately.
- **Global pause:** pauses scheduled and manual agent work.
- **Individual flags:** independently gate Research, Blogging, Chip learning,
  and affiliate resolution.
- **Source enabled:** gates ingestion and monetized resolution for that source.
- **Public outbound links:** independently allows a source to resolve publicly.
- **Safe mode:** keeps public outbound resolution non-monetized. Content and
  catalog workflows remain review-only regardless of this flag.
- **Calendar pause/caps:** gate scheduled research and automatic draft counts.

The daily scheduler also performs best-effort retention cleanup. Each category
drains up to 5,000 rows per run and reports a `*_capacity_reached` marker when
more may remain. It removes old
terminal jobs, audits, and aggregate-safe click events; expires Chip summaries;
deletes full legacy chat transcripts only after migration 031 supplies an
explicit retention setting; and scrubs retained raw product payloads according
to admin-configured limits. If settings cannot be read, destructive cleanup is
skipped rather than using fallback values.

## Verification

Before handing the branch to staging:

```powershell
npm test
npx tsc --noEmit
npm run build
git diff --check
```

Manual acceptance checks:

- Disabled/paused agents do not run.
- Concurrent or duplicate schedule delivery creates at most one durable run.
- Low-confidence research creates no blog draft.
- Quality-blocked generation creates no CMS post.
- Every generated post remains unpublished and retains its persona snapshot.
- Disabled sources produce no newly monetized redirect.
- Stale/missing prices render “Check current price” instead of an unsupported
  exact price.
- Affiliate click storage contains no raw URL, IP, user agent, cookie, session,
  referrer, or free-form browser metadata.
- Supabase anon/authenticated clients cannot read chat transcripts, read CMS
  internal columns, publish posts, or mutate site settings directly.
- Existing search, laptop detail, comparison, blog, and Chip flows still work.
- Platform/WAF rules throttle abusive traffic to paid public endpoints without
  blocking normal chat, transcription, or outbound-link use.

Provider calls requiring real credentials are staging smoke tests; unit tests do
not prove marketplace account access or live OpenAI output quality.

## Rollback

First enable the emergency stop, pause the calendar, disable every capability,
and deploy code that no longer reads the new schema. Then run these destructive
rollbacks manually in exact reverse order:

1. `032_harden_catalog_and_taxonomy_access_rollback.sql`
2. `031_harden_chat_and_blog_access_rollback.sql`
3. `030_create_affiliate_click_events_rollback.sql`
4. `029_create_blog_agent_metadata_rollback.sql`
5. `028_create_chip_learning_rollback.sql`
6. `027_add_blog_personas_rollback.sql`
7. `026_create_research_calendar_rollback.sql`
8. `025_create_product_research_rollback.sql`
9. `024_create_agent_foundations_rollback.sql`

Export any agent records that must be retained before rollback. These files
remove the newly introduced tables/columns and their data; they do not roll back
the pre-existing laptop catalog, CMS, or chat tables.

## Official integration references

- OpenAI models: https://developers.openai.com/api/docs/models
- OpenAI web search: https://developers.openai.com/api/docs/guides/tools-web-search
- OpenAI structured outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI Responses API: https://developers.openai.com/api/docs/guides/migrate-to-responses
- OpenAI transcription model: https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe
- Amazon Creators API: https://affiliate-program.amazon.com/creatorsapi/docs/
- Flipkart Affiliate API: https://affiliate.flipkart.com/api-docs/affiliate_index.html
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
