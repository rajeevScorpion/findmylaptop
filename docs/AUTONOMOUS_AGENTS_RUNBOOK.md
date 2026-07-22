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
- Research novelty defaults to a 180-day platform history window, a 62%
  similarity cutoff, and source rotation enabled.
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
10. `033_add_research_novelty.sql`
11. `034_add_product_curation.sql`

Do not continue after an error. Record the failing statement and inspect the
database state before retrying.

Migration 033 must be applied manually to the staging Supabase project only
after migration 032 and compatible application code are ready, with the
Research Agent still disabled. It is not applied by application deployment.
It adds and backfills Research Calendar novelty policy and packet-history
metadata, adds typed no-topic reasons, makes the exact normalized-title claim
atomic, and adds the global lease that serializes deterministic novelty work.
No environment variable substitutes for this migration.

Migration 034 adds disabled-by-default product-curation rulebooks, the daily
schedule and Amazon API budget, admin-reviewed course-mapping proposals, and
candidate curation metadata. Apply it only after 033 and compatible application
code are deployed to staging. Do not enable automation until each domain
rulebook has been reviewed and compiled.

## Preview activation sequence

1. Confirm the branch is deployed to the staging project and all agent flags are off.
2. Confirm an allowlisted admin can open **Admin > Growth Agents**.
3. Validate source health. **Probe health** saves the credential result without
   enabling a source; turning on an API source performs the same fresh check and
   enables it only after success. For Amazon, import one staging candidate after
   activation as the end-to-end catalog-access test. Keep Flipkart and any
   unverified source disabled.
4. Test a manual product candidate, then reject or promote it. Promotion must
   create an unpublished laptop only.
5. Enable the Research Agent and keep the calendar paused. Open **Admin >
   Growth Agents > Research Calendar**, keep the 180-day history window, 62%
   similarity cutoff, and source rotation defaults, then use **Run now** on one
   day. Inspect its source references, confidence, novelty result, and any
   typed no-topic reason before handoff.
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
12. Open **Admin > Growth Agents > Product Curation**. Keep it paused, compile
    one domain rulebook, audit the existing catalog, then run Refresh now and
    Discover now. Verify course changes and candidates remain admin-approved.
    The product-curation cron polls at 21:30 UTC (approximately 03:00 IST).

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
- **Topic history window:** compares each candidate platform-wide with research
  non-rejected packets and non-archived CMS posts from the configured 90–365
  day period; the default is 180 days. Rejected packets use a separate fixed
  30-day comparison window even when this control is wider.
- **Similarity cutoff:** controls the weighted deterministic comparison from
  20% to 95%; the default is 62%, and lower values reject more related angles.
  Hard exact and same-source/topic anchors can reject below this percentage.
- **Source rotation:** checks the last two non-empty research runs for the same
  calendar day within 14 days and withholds recently dominant primary domains.
  If none of the approved domains remain, the run returns `source_rotation`
  rather than silently broadening web search.

## Deterministic topic novelty

Each OpenAI research call is stateless. The model does not remember earlier
runs, and this workflow does not use embeddings or hidden model memory. The
server creates awareness through an explicit, deterministic sequence:

1. It claims a platform-wide novelty lease. Only one Research Calendar run can
   hold this lease, so runs cannot load the same history snapshot and then
   persist competing paraphrases in parallel. A busy run is retried.
2. It loads non-rejected research packets and non-archived `blog_posts` from
   the configured history window, plus rejected packets from only the last 30
   days. It then supplies those covered titles and angles to the research call.
3. If the combined eligible history exceeds 500 items, the run fails closed
   before web research. It never silently truncates the comparison set. Shorten
   the history window, archive genuinely obsolete CMS posts, or review
   retention and data volume before retrying.
4. After generation, it applies an independent weighted feature comparison
   before persistence. The comparison evaluates normalized title and angle
   text plus subject/product, intent, audience, content type, canonical source,
   and source-domain overlap.
5. It persists accepted packets and releases the novelty lease before optional
   Blog draft generation.

The configured cutoff governs the weighted comparison when a strong topic
anchor is present. Three hard cases can reject independently of that percentage:

- The **exact-title fingerprint** matches. This is readable normalized title
  text, not a model score.
- The **subject key** matches. This is a separate rich hash built from
  normalized source-domain, subject/product, intent, audience, content-type,
  and title-token features.
- The canonical source URL and root domain match while subject/product and
  intent also match.

For an accepted candidate, persistence atomically claims the exact-title
fingerprint so concurrent workers cannot both create that title. The normal
comparison window defaults to 180 days and can be configured in **Research
Calendar > Schedule control** from 90 to 365 days; rejected packets still use
their fixed 30-day window. The default weighted similarity cutoff is 62%.
Exact-title claims remain reserved after the ordinary history window and after
packet status changes.

A completed zero-packet run remains `no_good_topic` and records a typed reason:

- `duplicate_topic`
- `insufficient_freshness`
- `insufficient_evidence`
- `source_rotation`
- `source_configuration`
- `no_qualifying_candidate`

The admin Calendar presents these expected outcomes as wrapped amber notices
and reason badges, including on narrow mobile screens. Provider, schema,
authorization, and database failures remain failed runs rather than no-topic
outcomes.

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
- Running the same or a substantially similar topic again is rejected against
  recent packets and non-archived CMS posts, and the reason is visible in the
  Calendar UI.
- Two concurrent attempts cannot both persist the same exact normalized title.
- Parallel Research Calendar runs serialize history, selection, and persistence
  through the global novelty lease; a competing run retries and then sees the
  first run's persisted topic.
- More than 500 combined eligible history items stops research before a provider
  call instead of silently truncating comparison history.
- A rejected packet older than 30 days is excluded from comparison even when
  the main history window is wider; a 29-day-old rejected packet is included.
- Source rotation considers only the last two non-empty research runs for the
  same day within 14 days and never expands the approved-domain allowlist.
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

1. `034_add_product_curation_rollback.sql`
2. `033_add_research_novelty_rollback.sql`
3. `032_harden_catalog_and_taxonomy_access_rollback.sql`
4. `031_harden_chat_and_blog_access_rollback.sql`
5. `030_create_affiliate_click_events_rollback.sql`
6. `029_create_blog_agent_metadata_rollback.sql`
7. `028_create_chip_learning_rollback.sql`
8. `027_add_blog_personas_rollback.sql`
9. `026_create_research_calendar_rollback.sql`
10. `025_create_product_research_rollback.sql`
11. `024_create_agent_foundations_rollback.sql`

Export any agent records that must be retained before rollback. These files
remove the newly introduced tables/columns and their data; they do not roll back
the pre-existing laptop catalog, CMS, or chat tables.

The migration-033 rollback removes novelty metadata, calendar policy fields,
exact-title claims, and the global novelty lease, and restores the original
migration-026 research persistence and completion functions. Deploy code that
no longer reads the novelty fields or calls the novelty functions before
running it, and always run it before rollback 032. Neither the forward nor the
rollback file is applied automatically.

## Official integration references

- OpenAI models: https://developers.openai.com/api/docs/models
- OpenAI web search: https://developers.openai.com/api/docs/guides/tools-web-search
- OpenAI structured outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI Responses API: https://developers.openai.com/api/docs/guides/migrate-to-responses
- OpenAI transcription model: https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe
- Amazon Creators API: https://affiliate-program.amazon.com/creatorsapi/docs/
- Flipkart Affiliate API: https://affiliate.flipkart.com/api-docs/affiliate_index.html
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
