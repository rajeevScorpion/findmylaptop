# Investigation-First Codebase and API Audit

This file must be executed before implementation. The AI coder must inspect the current project and produce a written audit.

## A. Codebase audit

Identify:

- Framework and runtime: Next.js, React, Node, Express, Python, Supabase, Firebase, WordPress, custom CMS, etc.
- Database and ORM/query layer.
- Auth system and admin roles.
- Existing laptop/product schema.
- Existing recommendation/chat/Chip code.
- Existing blog/CMS system.
- Existing affiliate link generator or URL fields.
- Existing analytics/tracking implementation.
- Existing cron/job/queue implementation.
- Existing deployment and env variable conventions.
- Existing test setup.

## B. Current user flows

Document current flows:

- User searches or chats for laptop recommendation.
- Chip asks/answers questions.
- Product cards are shown.
- Links are clicked.
- Blogs are created/published, if blog exists.
- Admin manages products, if admin exists.

## C. External source/API audit

Investigate current feasibility for:

### Amazon

- Current Amazon Associates status.
- Whether Creators API access is available.
- Whether any legacy PA-API usage exists and whether migration is needed.
- Required marketplace/locale for India.
- Whether price, availability, image, title, ratings can be displayed.
- Required timestamp/disclaimer behavior.
- Rate limits and cache limits.
- Fallback if API access is unavailable: manual product URL import, Amazon SiteStripe/affiliate link generation, admin-entered products, CSV upload, or approved plugin/feed.

### Flipkart

- Current Flipkart affiliate account status.
- API token availability.
- Current product feed/search/offer API behavior.
- Required headers and tracking ID handling.
- Rate limits, response formats, stale data behavior.
- Whether product category feeds include laptops consistently.

### Other sources

Investigate approved and lawful options:

- Brand websites with affiliate network support.
- Cuelinks or other affiliate networks if already used or desired.
- Manual admin product import.
- CSV upload.
- Google Sheets import.
- Price-comparison APIs only if terms permit.

Do not use marketplace scraping unless legal/allowed and explicitly approved.

## D. Deliverable: Investigation report

Create `docs/INVESTIGATION_REPORT.md` with:

1. Current architecture summary.
2. What exists and can be reused.
3. What is missing.
4. API/source feasibility table.
5. Risks and blockers.
6. Recommended implementation plan.
7. Clarifying questions after investigation.
8. Exact files likely to change.
9. Rollback plan.

Stop and wait for approval after this report.
