# Research Agent Daily Schedule + Admin-Configurable Editorial Calendar

## Purpose

LaptopFinder should not depend on random blog ideas or occasional manual research. The Research Agent should run daily on a configured schedule, gather theme-specific findings, and pass structured research packets to the Blog Writer / Persona Author Agent.

The weekly schedule, daily post count, source priority, automation level, and approval rules must be configurable by admin from the platform. Do not hard-code the weekly calendar in code.

## Core concept

Each day has an editorial/research theme. The Research Agent runs according to the active schedule, collects relevant news/product/software/deal/course information, and creates one or more research packets.

The Blogging Agent then turns approved packets into drafts, scheduled posts, or auto-published posts depending on admin settings.

## Default weekly schedule

Use this only as seed data. Admin must be able to edit it.

| Day | Default research theme | Main output type | Suggested personas |
|---|---|---|---|
| Monday | New tech and hardware trends | Explainer / trend insight | AI hardware analyst, student laptop advisor |
| Tuesday | Software requirements and updates | Software-specific laptop guide | Senior design professor, coding specialist |
| Wednesday | Course/program laptop guides | Student decision guide | Design educator, CSE mentor, parent-friendly advisor |
| Thursday | Deals, price movement, value picks | Shortlist / comparison / buying alert | Budget mentor, laptop reviewer |
| Friday | Brand, service, warranty, trust-building | Trust article / buying confidence article | Service expert, parent-friendly advisor |
| Saturday | Comparisons and user FAQs | Comparison article / Chip insight article | Practical laptop reviewer, coding specialist |
| Sunday | Weekly roundup and evergreen planning | Weekly digest / upcoming content plan | Editorial desk / student advisor |

Admin should be able to rename themes, disable days, add multiple themes per day, and create special campaigns such as admission season, festive sales, back-to-college, design entrance season, or CSE admission season.

## Configurable admin settings

Create an admin screen: **Growth Agents > Research Calendar**.

Settings must include:

- Enable/disable daily Research Agent schedule
- Run time per day
- Timezone
- Active days
- Day-wise theme
- Day-wise research keywords
- Day-wise target audience
- Day-wise preferred personas
- Day-wise post count target
- Minimum posts per day
- Maximum posts per day
- Draft-only / approval-required / auto-schedule / auto-publish mode
- Source priority by day
- Affiliate-link insertion rule by day
- Product card insertion limit per post
- Minimum research confidence score
- Minimum blog quality score
- Whether trending/news items expire automatically
- Expiry window for research packets
- Manual pause button
- Manual run-now button
- Emergency stop for all agents

## Daily post count rules

The admin should be able to configure:

```ts
type DailyPostTarget = {
  minPosts: number;       // default 0
  targetPosts: number;    // default 1
  maxPosts: number;       // default 2
  allowCarryForward: boolean;
  carryForwardLimitDays: number;
}
```

Recommended default for MVP:

- `minPosts: 0`
- `targetPosts: 1`
- `maxPosts: 2`
- `allowCarryForward: true`
- `carryForwardLimitDays: 7`

This allows the system to create drafts even when quality is not good enough for publishing. If research quality is weak, the agent should not force a low-quality article.

## Research packet format

Each scheduled run should produce one or more `research_packet` records.

```ts
type ResearchPacket = {
  id: string;
  scheduleRunId: string;
  calendarDay: string;
  themeId: string;
  themeName: string;
  targetAudience: string[];
  suggestedPersonas: string[];
  topicTitle: string;
  topicAngle: string;
  summary: string;
  findings: ResearchFinding[];
  productCandidates: string[];
  sourceRefs: SourceReference[];
  confidenceScore: number;
  urgency: 'low' | 'medium' | 'high';
  contentType: 'news' | 'software-guide' | 'buying-guide' | 'comparison' | 'deal-roundup' | 'trust-education' | 'weekly-roundup' | 'evergreen';
  monetizationIntent: 'none' | 'soft-contextual' | 'product-cards' | 'comparison-links';
  expiresAt?: string;
  status: 'draft_packet' | 'ready_for_blog' | 'needs_admin_review' | 'used' | 'rejected' | 'expired';
  createdAt: string;
}
```

## Workflow

1. Scheduler triggers Research Agent based on admin calendar.
2. Research Agent reads the active day configuration.
3. Agent gathers theme-specific information from approved sources.
4. Agent normalizes product candidates where relevant.
5. Agent generates research packets.
6. Packets are scored for source quality, usefulness, freshness, and monetization fit.
7. Packets go to admin review or directly to Blogging Agent based on settings.
8. Persona-Based Blog Author Agent selects author persona from allowed personas.
9. Blog draft is created.
10. Draft is scheduled/published based on admin approval rules.
11. Performance data is logged and used to improve future topics.

## Admin modes

### Safe MVP mode

- Research Agent runs daily.
- Blog drafts are created.
- Nothing is published without admin approval.
- Affiliate links can be inserted only after admin approval.

### Assisted automation mode

- Research Agent runs daily.
- High-confidence topics become scheduled drafts.
- Admin receives notification/queue.
- Posts still require final approval.

### Controlled auto-publish mode

- Only evergreen and high-confidence content can auto-publish.
- News/deal posts require stricter freshness checks.
- Admin can set max auto-published posts per day/week.
- Any post containing price/deal claims must include freshness timestamp and compliant CTA.

## Source rules by theme

### New tech day

Use sources related to hardware launches, CPU/GPU generations, AI PC trends, laptop announcements, OS/hardware updates, and official manufacturer pages.

### Software day

Use official software requirement pages wherever possible. For design/coding workflows, prefer official documentation from Adobe, Autodesk, Blender, Android Studio, Apple, Microsoft, Python, Docker, Unity, Unreal, etc.

### Deals/value day

Use only approved affiliate/API/product feed sources. Do not scrape ecommerce pages if not permitted. Prefer “Check current price” over stale price claims.

### Trust-building day

Use stable evergreen knowledge, service/warranty facts from official pages where possible, and LaptopFinder’s own product/recommendation philosophy.

## Topic quality rules

The Research Agent should reject or downgrade topics when:

- The topic is too thin or repetitive.
- The sources are weak or unverifiable.
- The product data is stale.
- The topic exists only to push affiliate links.
- The same article angle was used recently.
- The persona author would need to invent expertise or unverifiable claims.

## Admin calendar UI requirements

The calendar should show:

- Week view with day-wise themes
- Daily target post count
- Last run status
- Next run time
- Number of packets produced
- Number of drafts produced
- Number of scheduled posts
- Number of posts awaiting approval
- Error/warning status
- Pause/run-now buttons

Each day row should allow editing:

- Theme name
- Theme description
- Keywords
- Target audience
- Allowed content types
- Allowed personas
- Source priority
- Post target
- Approval mode
- Active/inactive status

## Notifications

Create admin notifications for:

- Daily run completed
- No good topic found
- Draft generated
- Draft needs approval
- Source/API failure
- Price/product data stale
- Auto-publish skipped due to risk
- Agent paused due to repeated errors

## Acceptance criteria

- Research Agent can run every day based on admin-configured schedule.
- Monday/Tuesday/etc. themes are seed data, not hard-coded logic.
- Admin can change daily themes and post count without developer changes.
- Daily post count can be set per day.
- Low-quality research does not force publishing.
- Research packets connect cleanly to persona-based blog authors.
- All schedule runs are logged with success/failure states.
- Existing product search and blog functionality does not break.
