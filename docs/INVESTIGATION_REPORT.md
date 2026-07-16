# Autonomous Growth Agents — Investigation Report

Date: 2026-07-16  
Branch: `laptopfinder_autonomous_agents_prompt_pack`  
Base: `preview` / `origin/preview` at `da655bf`

## Executive summary

LaptopFinder already has reusable product, Amazon Creators API, recommendation, Chip chat, blog/CMS, admin, authentication, feature-flag, and Supabase foundations. The autonomous prompt pack should extend those systems rather than introduce a separate agent framework or duplicate CMS.

The missing layer is a controlled growth-agent platform: restricted settings, durable jobs and locks, source adapters, a product-candidate review queue, a database-configured research calendar, research packets, topic/draft handoff, first-class author personas, structured Chip learning, centralized affiliate resolution, click tracking, scheduler entry points, retention controls, tests, and rollback documentation.

All agent capabilities will fail closed and start disabled or in draft/review-only mode. This branch will contain migration files, but no migration will be applied to staging or production by Codex.

## 1. Current architecture

| Area | Current implementation |
|---|---|
| Framework | Next.js 16.2.6 App Router, React 19.2.4, strict TypeScript, Tailwind CSS 4 |
| Rendering/cache | `cacheComponents: true`; explicit `use cache`, `cacheLife`, and `cacheTag` are already used |
| Database | Supabase Postgres; manual SQL migrations; direct Supabase queries; no ORM/generated DB client |
| Authentication | Supabase Auth; `/admin` protected by `src/proxy.ts`; admin allowlist from `ADMIN_EMAILS` |
| Products | `laptops` is the approved/public catalog, with normalized specs, editorial fields, ranking, publish state, Amazon URL, and ASIN |
| Recommendation | Deterministic recommendation engine plus domain-aware filters and product cards |
| Chip | OpenAI-backed chat route with catalog grounding, session limits, transcripts, recommendations, and feedback |
| Blog/CMS | Structured block CMS with categories, SEO, AI draft assistance, review statuses, public pages, product placeholders, and sitemap support |
| Amazon | Creators API OAuth/GetItems integration, manual URL import, ASIN resolution, current price refresh, and affiliate URL generation |
| Analytics | Vercel Analytics and a visit counter; no affiliate-click or agent-performance event model |
| Jobs | No durable queue, scheduler configuration, job locks, retry state, or worker process |
| Tests | No unit/E2E framework or test script; `next build` is the only current automated verification |
| Deployment | Vercel-oriented Next.js deployment; preview workflow targets `dev.laptopfinder.cc` |

The clean baseline production build passed on 2026-07-16 before feature edits.

## 2. Existing code to reuse

### Products and sources

- `src/lib/amazon-creators.ts`: current Creators API client and affiliate URL builder.
- `src/app/api/admin/fetch-amazon/route.ts`: Amazon URL/ASIN import flow.
- `src/app/api/admin/process-laptop/route.ts` and `src/lib/extractionPrompt.ts`: manual product-text normalization.
- `src/lib/duplicate-detection.ts`: catalog duplicate checks.
- `src/lib/schemas.ts`: laptop runtime validation.
- `src/lib/recommendationEngine.ts`: deterministic fit ranking.
- `src/components/admin/LaptopForm.tsx`: final manual editorial review.

### Blog and personas

- `src/lib/blog/`: current post schemas, types, queries, slugs, TOC, and product intent.
- `src/lib/ai/blog-writer.ts`: safe draft-only writer and generation logging.
- `src/components/admin/blog/BlogPostForm.tsx`: existing editor and publication workflow.
- `src/app/blog/[slug]/page.tsx`: public post and structured-data rendering.

The existing `blog_posts` table will remain the canonical draft/post store. A second `blog_drafts` table would duplicate state and is not recommended.

### Chip and admin

- `src/app/api/chat/route.ts`: current Chip flow and transcript persistence.
- `src/app/admin/feedback/page.tsx`: existing review surface for conversations.
- `src/lib/flags.ts`: fail-closed feature-flag pattern.
- `src/app/admin/layout.tsx` and `src/components/admin/AdminSidebar.tsx`: admin shell.
- `src/components/ui/`: reusable UI controls.

## 3. Missing capabilities

- Restricted agent configuration and independent kill switches.
- Durable job state, idempotency keys, locks, retry state, health logs, and admin notifications.
- Typed source-adapter registry and source health checks.
- Manual/Amazon/Flipkart candidate ingestion behind a review queue.
- Multi-source product offers; the current product model assumes Amazon.
- Editable weekly research calendar, run history, and structured research packets.
- Web-research integration with source references and task-specific model routing.
- Topic queue and safe packet-to-blog draft handoff.
- Persona records, version snapshots, CRUD/lifecycle controls, selection, preview, and audit trail.
- Public persona author cards and author archive pages.
- Structured pseudonymous Chip events and session preference summaries.
- Central affiliate resolver, source controls, compliant stale-price fallback, and click events.
- Protected scheduler endpoint and a deployment-scheduler configuration decision.
- Retention controls, unit/integration tests, and autonomous-agent rollback/runbooks.

## 4. External API and model feasibility

| Source | Finding | MVP decision |
|---|---|---|
| Amazon | The code already uses Creators API. Amazon's PA-API documentation says PA-API retired on 2026-05-15, so no new PA-API implementation should be introduced. Creators API credentials are configured locally, but access still requires a live health check. | Wrap the existing client in an adapter; never scrape; fail closed; keep manual URL import as fallback. |
| Flipkart | Official Affiliate API documentation still describes token-authenticated product/feed endpoints using `Fk-Affiliate-Id` and `Fk-Affiliate-Token`. No Flipkart credentials are configured in the repository environment. | Implement a disabled adapter and health check; enable only after real credential verification. No scraping. |
| Other marketplaces | No approved account or feed is currently configured. | Keep an adapter interface and manual import; add providers individually after terms/account review. |
| Web research | The installed OpenAI SDK supports Responses API, hosted `web_search`, Zod structured outputs, and source inclusion. | Use Responses API with `web_search`, `store: false`, source references, and approved-domain controls where appropriate. |
| Model routing | Current code hardcodes/de facto defaults to `gpt-4o-mini`, while current OpenAI guidance recommends the GPT-5.6 family and Responses API for new agentic work. | Default research to `gpt-5.6-terra`; default high-volume writing, extraction, and Chip work to `gpt-5.6-luna`; expose every model through server-only environment variables. |

Official references checked:

- OpenAI model guidance: https://developers.openai.com/api/docs/models
- OpenAI web search: https://developers.openai.com/api/docs/guides/tools-web-search
- OpenAI Responses migration: https://developers.openai.com/api/docs/guides/migrate-to-responses
- Amazon Creators API: https://affiliate-program.amazon.com/creatorsapi/docs/
- Amazon India PA-API retirement notice: https://webservices.amazon.com/paapi5/documentation/locale-reference/india.html
- Flipkart Affiliate API: https://affiliate.flipkart.com/api-docs/affiliate_index.html

## 5. Risks and safeguards

### Authorization and configuration

Existing RLS grants broad write access to authenticated users, while the email allowlist is enforced mainly in application UI/API code. The existing `settings` table is also publicly readable. Agent configuration, persona prompts, source configuration, and automation state must therefore use new restricted tables and server-only route handlers with a shared admin authorization helper.

### Multi-source compatibility

`laptops.amazon_affiliate_url` is `NOT NULL`, and public components read it directly. Making that field nullable would create a broad regression risk. The safe migration is to add `product_offers`, preserve the Amazon column as a legacy fallback, and move public outbound clicks through a central resolver.

### Scheduling

There is no existing queue. Serverless memory cannot provide durable locks or retries. Jobs, idempotency, and schedule runs must be stored in Supabase. The scheduler route will poll database configuration in small bounded batches; it will never rely on module memory or a long-running in-request loop.

### Existing cron-like route

The current price-refresh route accepts a cron secret but uses the cookie/anonymous Supabase client and does not consistently check update errors. Cron execution can therefore report success while writes fail under RLS. Autonomous scheduler code must use service-role access, centralized secret verification, checked writes, and persisted status.

### Privacy

Raw Chip transcripts already exist without a retention job. The MVP will not infer or store sensitive personal data. New learning data will be pseudonymous, minimal, independently disableable, and governed by retention settings. Existing transcripts will not be deleted automatically by these migrations.

### Content and compliance

- No marketplace scraping.
- No public use of unapproved candidates.
- No autonomous publishing by default.
- No exact price when freshness/compliance checks fail; use “Check current price.”
- No fictional-persona credential claims; every editorial persona is clearly disclosed.
- No affiliate or LLM secrets in client bundles, public tables, or logs.

## 6. Implementation plan

1. Foundation: shared admin/cron authorization, restricted settings, flags, jobs, source registry, model routing, and affiliate interfaces.
2. Sources/candidates: manual and Amazon adapters, disabled Flipkart adapter, normalization/scoring, product offers, candidate queue, and admin review.
3. Research calendar: normalized multi-theme calendar, run logs, packets, notifications, run-now, pause, and protected polling route.
4. Blogging: topic queue, packet-to-draft generation, fact-check metadata, scheduling state, and review UI.
5. Personas: versioned persona records, management/preview/selection, immutable post snapshots, public author cards, and author archive route.
6. Chip: structured interaction events, session summaries, retention controls, and profile-grounded reasoning behind a flag.
7. Monetization: centralized outbound resolver, offers, click tracking, disclosure/freshness behavior, and public-link migration.
8. Hardening: Vitest service tests, route/service integration tests, build regression, runbook, migration order, and rollback instructions.

Each schema phase will have a paired forward and rollback migration. Migrations begin at `024` because the repository already has two different `022` migrations and ends at `023`.

## 7. Post-investigation decisions

The user explicitly authorized implementation after confirmation, so these recommended safe defaults resolve non-blocking ambiguities without another stop:

- Use branch name `laptopfinder_autonomous_agents_prompt_pack` as requested.
- Extend the existing CMS and `ADMIN_EMAILS` role model; all new sensitive mutations remain server-only and audited.
- Add `product_offers` and preserve `amazon_affiliate_url` for backward compatibility.
- Manual and Amazon sources are implemented first; Flipkart remains disabled until credentials pass a health check.
- Safe mode blocks automated approval, affiliate insertion, scheduling, and publishing; it does not block explicit existing-admin review actions.
- All generated products/posts begin as pending/draft/review records.
- Use configurable GPT-5.6 model routing; no model string or budget decision is exposed to the browser.
- Seed all provided personas as clearly disclosed editorial personas that always require manual review.
- Store notifications in the admin database/UI; do not assume email/Slack infrastructure.
- Represent multiple themes per weekday as multiple normalized day rows.
- Use a seven-draft weekly ceiling for the seeded calendar; per-day quality gates may produce zero.
- Manual form/JSON import is MVP. CSV and Google Sheets remain future adapters.
- New Chip events default to 90-day retention; job and click logs default to 365 days; cleanup is admin/scheduler controlled.
- A disabled source blocks new fetches and affiliate resolution; the resolver may use a validated ordinary canonical product URL as a non-affiliate fallback.

No production database, `master` branch, external account, or live publishing setting will be changed without explicit approval.

## 8. Expected file surface

New files will primarily live under:

- `src/lib/admin/`
- `src/lib/growth-agents/`
- `src/lib/sources/`
- `src/lib/affiliate/`
- `src/lib/personas/`
- `src/app/api/admin/growth-agents/`
- `src/app/api/cron/growth-agents/`
- `src/app/api/out/`
- `src/app/admin/growth-agents/`
- `src/app/admin/personas/`
- `src/app/blog/author/[slug]/`
- `supabase/migrations/024_*` onward

Existing files likely to change include `.env.example`, `package.json`, `src/lib/flags.ts`, blog types/queries/writer/editor, `src/app/api/chat/route.ts`, the public blog page, sitemap, admin sidebar, public product-link components, and migration documentation.

## 9. Rollback approach

- Every forward migration has a paired rollback file and is handed off in forward order; rollback order is the exact reverse.
- New behavior is guarded by independent flags and a global emergency stop.
- Public product links can revert to the legacy Amazon URL without dropping data.
- Existing posts without personas continue to render the LaptopFinder organization author.
- Existing Chip behavior remains the fallback when learning is disabled or profile reads fail.
- Scheduler failures produce durable failed job/run records and never publish.
- Rollback migrations preserve the existing `laptops`, `blog_posts`, `chat_sessions`, and legacy settings structures; destructive removal is limited to newly introduced tables/columns after dependent data is no longer needed.
