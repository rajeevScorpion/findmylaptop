# Admin Panel and Settings

## Purpose

Admin must be able to control automation, sources, publishing, monetization, and learning without code changes.

## Required admin sections

### 1. Agent Control

Fields:

- Research Agent: enabled/disabled
- Blogging Agent: enabled/disabled
- Chip Learning: enabled/disabled
- Orchestrator cron: enabled/disabled
- Global safe mode: enabled/disabled

### 2. Source Settings

Per source:

- Source name
- Enabled/disabled
- API mode / manual mode
- Affiliate tracking ID configured/not configured
- Last successful fetch
- Last error
- Cache/freshness policy
- Public display allowed
- Requires admin approval

### 3. Research Queue

Admin actions:

- Approve candidate
- Reject candidate
- Edit specs
- Merge duplicate
- Mark stale
- Mark trusted
- Request re-fetch
- Add note

### 4. Blog Queue

Admin actions:

- Approve topic
- Reject topic
- Edit outline
- Generate draft
- Approve draft
- Schedule draft
- Publish now, if existing CMS supports it
- Return to revision

### 5. Chip Settings

Fields:

- Learning enabled
- Anonymous memory duration
- Logged-in memory duration
- Max product suggestions per response
- Affiliate links in Chip enabled/disabled
- Disclosure text
- Confidence threshold
- Fallback WhatsApp/community link

### 6. Monetization Settings

Fields:

- Amazon affiliate enabled
- Flipkart affiliate enabled
- Other sources enabled
- Ads enabled
- Product card CTA text
- Blog affiliate disclosure
- Chip affiliate disclosure
- Max affiliate links per blog

### 7. Logs and Health

Show:

- Agent job runs
- Source sync status
- API errors
- Blog generation errors
- Product normalization errors
- Affiliate resolver errors
- Click tracking summary

## Suggested settings schema

```ts
type AgentSettings = {
  researchAgentEnabled: boolean;
  bloggingAgentEnabled: boolean;
  chipLearningEnabled: boolean;
  safeModeEnabled: boolean;
  autoPublishBlogsEnabled: boolean;
  productAutoApproveEnabled: boolean;
  minProductConfidence: number;
  minBlogQualityScore: number;
  maxBlogPostsPerWeek: number;
  maxChipProductLinks: number;
  affiliateDisclosure: string;
  sources: SourceSettings[];
}
```

## Acceptance criteria

- Admin can turn off each major capability.
- Admin can review generated work.
- Admin can see errors and job logs.
- No autonomous publishing occurs unless explicitly configured.
- Settings survive deployment/restart.

### 8. Persona Management

Admin must have a dedicated Persona Management Tool.

Actions:

- Define persona blueprint
- Create persona
- Edit persona
- Preview persona writing
- Enable/disable persona
- Archive persona
- Soft delete persona
- Hard delete persona only when safe
- Restore persona
- Reassign drafts/posts to another persona
- Set default/fallback persona
- Set persona priority weight

Fields:

- Display name
- Slug
- Public role/title
- Author type: human, AI/editorial persona, brand
- Public bio
- Avatar/icon
- Expertise tags
- Target audience tags
- Topic/software tags
- Persona prompt
- Tone settings
- Buying philosophy
- Affiliate/product-card permissions
- Required disclosure text
- Status
- Version

Blog Queue should also show:

- Selected persona
- Persona selection reason
- Change persona action
- Regenerate using another persona action
- Author-card preview

Admin safety rules:

- Disabling a persona prevents future use but preserves old attribution.
- Archiving removes persona from selection lists but keeps public author pages for old posts.
- Hard delete is blocked when published posts, scheduled posts, or active drafts depend on that persona.
- Fictional personas must be disclosed as LaptopFinder editorial/expert personas.


## Research Calendar Admin Tool

Add a section: **Growth Agents > Research Calendar**.

Admin should be able to configure the daily Research Agent schedule:

- Enable/disable schedule
- Day-wise theme
- Day-wise run time
- Day-wise keywords
- Day-wise target audience
- Day-wise preferred personas
- Day-wise source priority
- Daily minimum, target, and maximum post count
- Draft-only / approval-required / auto-schedule / controlled auto-publish mode
- Affiliate insertion mode
- Maximum product cards per post
- Minimum quality/confidence scores
- Pause all agents
- Run now
- View last run and next run
- View packets/drafts produced

The default weekly calendar should be seeded, but fully editable. Admin changes should not require deployment.
