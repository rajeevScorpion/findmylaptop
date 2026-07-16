# Job Queue, Scheduling, and Workers

## Goal

Agents need scheduled execution, but the MVP should be simple and compatible with the current deployment.

## Investigate first

Check whether the project already uses:

- Cron routes
- Supabase scheduled functions
- Vercel cron
- Node workers
- BullMQ / Redis
- Cloudflare workers
- GitHub Actions
- WordPress cron
- External scheduler

## MVP scheduling recommendation

Start with one safe scheduled entry point:

- Protected server-side route or scheduled function.
- Secret token required.
- Reads agent settings.
- Acquires lock.
- Runs small jobs.
- Logs status.

## Job lock

Prevent duplicate runs:

```ts
await acquireLock('research.discover_laptops', { ttlMinutes: 30 })
```

## Retry policy

- Retry network failures with backoff.
- Do not retry policy/compliance failures automatically.
- Stop after configured max attempts.
- Alert/log when failed.

## Suggested default frequencies

- Research product discovery: daily or 2-3x/week in MVP.
- Product refresh: daily for approved products if API permits.
- Blog topic discovery: weekly.
- Blog draft generation: 1-2 posts/week.
- Chip interaction summarization: daily.
- Analytics/growth insight summary: weekly.

## Safe mode

When safe mode is enabled:

- Do not publish.
- Do not auto-approve products.
- Do not send external links automatically except existing user-triggered product cards.
- Only generate drafts/review items.

## Acceptance criteria

- Jobs do not overlap.
- Jobs are logged.
- Failed jobs do not break user-facing pages.
- Admin can disable scheduler.
- Local/dev mode can run jobs manually.


## Daily Research Calendar Scheduler

The scheduler should read active `research_editorial_calendar` configuration from the database. It should not rely on a static cron per theme.

Required behavior:

- Run Research Agent on enabled days at the admin-configured time.
- Respect timezone.
- Support manual run-now.
- Support pause/emergency stop.
- Log every run in `research_schedule_run`.
- Retry transient API errors safely without duplicate blog generation.
- Do not run more often than admin configuration permits.
- Pass generated `research_packet` records to the Blog Writer queue only when status and quality thresholds allow it.
