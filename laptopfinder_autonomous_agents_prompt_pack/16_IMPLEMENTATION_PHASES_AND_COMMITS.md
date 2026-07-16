# Implementation Phases and Commit Plan

Each phase should end with tests and a commit. Do not implement all features at once.

## Branch

Create branch:

```bash
git checkout -b feature/laptopfinder-autonomous-agents
```

## Phase 0 — Investigation only

Deliver:

- `docs/INVESTIGATION_REPORT.md`
- Feasibility summary
- Clarifying questions after investigation

Commit:

```bash
git commit -m "docs: audit autonomous agent integration scope"
```

## Phase 1 — Foundations

Deliver:

- Feature flags
- Admin settings schema/service
- Agent job log model
- Source adapter interface
- Affiliate resolver interface
- No user-facing behavior change

Commit:

```bash
git commit -m "feat: add autonomous agent foundations and settings"
```

## Phase 2 — Source adapters and product candidates

Deliver:

- Manual source adapter
- Amazon adapter scaffold with current API investigation notes
- Flipkart adapter scaffold
- Product normalizer
- Product candidate storage
- Research queue admin view

Commit:

```bash
git commit -m "feat: add source adapters and product candidate queue"
```

## Phase 3 — Research Agent draft mode

Deliver:

- Research job
- Normalization + scoring
- Candidate review workflow
- Admin approve/reject
- Logs and error states

Commit:

```bash
git commit -m "feat: enable research agent draft workflow"
```

## Phase 4 — Blogging Agent draft mode

Deliver:

- Topic queue
- Blog draft generator
- SEO fields
- Fact-check checklist
- Admin review/schedule controls

Commit:

```bash
git commit -m "feat: add blogging agent draft workflow"
```

## Phase 5 — Chip interaction learning

Deliver:

- Interaction event logging
- Need extraction
- Session/user preference summary
- Recommendation reasoning enhancement
- Admin controls

Commit:

```bash
git commit -m "feat: add Chip interaction learning layer"
```

## Phase 6 — Monetization integration

Deliver:

- Central affiliate link resolver
- Source-specific affiliate URL handling
- Click tracking
- Disclosures
- Product card CTA integration
- Blog/Chip controlled link insertion

Commit:

```bash
git commit -m "feat: centralize affiliate link resolution and tracking"
```

## Phase 7 — Scheduling and automation

Deliver:

- Protected scheduler/cron
- Job locks
- Safe mode
- Admin-run manual jobs
- Automated draft generation only by default

Commit:

```bash
git commit -m "feat: add controlled scheduler for growth agents"
```

## Phase 8 — QA, monitoring, rollback

Deliver:

- Unit tests
- Integration tests
- Admin smoke tests
- Rollback docs
- Monitoring/error logs

Commit:

```bash
git commit -m "test: harden autonomous agent workflows"
```

## Phase 03A — Persona-based blog authoring

Goal: add first-class author personas for blog generation and public blog attribution.

Tasks:

- Investigate existing blog author/CMS model.
- Add persona schema/table and safe migration.
- Build Persona Management Tool in admin.
- Add persona CRUD service.
- Add persona selector service.
- Add persona preview/testing screen.
- Integrate persona selection into blog draft generation.
- Store persona snapshot/version with drafts/posts.
- Display persona author card on blog pages.
- Add author archive route where compatible.
- Add audit logs and tests.

Commit guidance:

- Keep this as a separate phase/PR from generic blogging automation.
- Do not mix persona management with product research scraping.
- Preserve existing blog behavior for posts without personas.


## Added phase: Research Calendar

Add this after the foundation/source adapter work and before full Blogging Agent implementation.

### Phase 02A — Research Calendar and Daily Schedule

- Create admin-configurable weekly research calendar.
- Seed Monday new tech, Tuesday software, Wednesday course guides, Thursday deals/value, Friday trust, Saturday comparisons/FAQs, Sunday roundup/evergreen.
- Add daily post count settings.
- Add schedule run logs.
- Add research packet handoff to Persona-Based Blog Author Agent.
- Keep default mode as draft-only.
- Commit: `feat(growth-agents): add configurable research calendar`
