# Research Agent — Amazon, Flipkart, and Other Sources

## Purpose

The Research Agent discovers useful laptops and prepares them for LaptopFinder recommendations, product lists, and blog product cards.

It should not blindly list every deal. It should filter, normalize, score, and explain.

## Source priority

1. Amazon India through current approved affiliate API path or manual affiliate URL fallback.
2. Flipkart through current affiliate API/token path if available.
3. Other approved sources through pluggable adapters.
4. Manual/CSV/Google Sheet imports as safe fallback.

## Data to collect

For each laptop candidate:

- Source name
- Source product ID / ASIN / listing ID if available
- Product URL
- Affiliate URL
- Title
- Brand
- Series/model
- CPU
- GPU
- RAM size and type
- RAM upgradeability if known
- SSD size and upgradeability if known
- Display size, resolution, refresh rate, color gamut if known
- Weight
- Battery
- Operating system
- Warranty
- Seller/store type
- Price if compliant and fresh
- Price timestamp if shown
- Availability if compliant and fresh
- Images if source terms allow
- Rating/review count if source terms allow
- Source confidence score
- Last fetched timestamp
- Fit tags
- Risk tags
- Admin notes

## Normalization rules

Create canonical spec fields:

```ts
type NormalizedLaptop = {
  id: string;
  source: 'amazon' | 'flipkart' | 'manual' | string;
  sourceProductId?: string;
  title: string;
  brand?: string;
  model?: string;
  cpu?: CpuSpec;
  gpu?: GpuSpec;
  ramGb?: number;
  ramType?: string;
  ramUpgradeable?: boolean | null;
  storageGb?: number;
  storageType?: 'SSD' | 'HDD' | 'Hybrid' | 'Unknown';
  display?: DisplaySpec;
  price?: Money;
  priceFetchedAt?: string;
  availability?: string;
  url: string;
  affiliateUrl?: string;
  imageUrl?: string;
  fitTags: string[];
  riskTags: string[];
  confidenceScore: number;
  complianceStatus: 'safe' | 'needs_review' | 'blocked';
  createdAt: string;
  updatedAt: string;
}
```

## Scoring dimensions

Score product candidates by:

- Budget fit
- CPU generation and performance tier
- GPU performance tier
- RAM adequacy and upgradeability
- SSD capacity and upgradeability
- Display suitability
- Build/service confidence
- Thermals if reliable evidence exists
- Brand/service network relevance in India
- Fit for target course/software
- Current source reliability
- Price/value if fresh price is available
- Affiliate monetization potential should never override fit quality

## Fit tags

Suggested tags:

- `cse`
- `design-foundation`
- `graphic-design`
- `ux-ui`
- `animation`
- `video-editing`
- `architecture`
- `fashion-design`
- `general-student`
- `gaming`
- `budget-value`
- `premium-reliable`
- `upgrade-friendly`
- `portable`
- `battery-focused`

## Risk tags

Suggested tags:

- `stale-price`
- `unknown-seller`
- `weak-gpu`
- `integrated-graphics-only`
- `low-ram`
- `non-upgradeable-ram`
- `small-ssd`
- `old-cpu-generation`
- `poor-display-for-design`
- `heavy-laptop`
- `gaming-looks-not-for-all`
- `insufficient-source-data`
- `needs-admin-review`

## Product list generation

Lists should support:

- Best laptops for CSE students
- Best laptops for design students
- Best laptops under ₹60k / ₹75k / ₹1L / ₹1.35L / ₹1.5L
- RTX 3050 vs RTX 4050 budget strategy
- RTX 4050 vs RTX 5050 / 5060 where current specs exist
- Laptop by course/program
- Laptop by software: Adobe, Blender, AutoCAD, Figma, coding, data science
- Parent-friendly buying guide

## Compliance safeguards

- If exact price cannot be verified and displayed compliantly, use CTA: “Check current price”.
- Show timestamps/disclaimers where required.
- Store source fetch time.
- Do not claim “best deal today” unless refreshed and verified.
- Do not use scraped data if terms do not permit it.
- Keep raw API responses only as allowed.

## Admin review flow

Research Agent output should enter review queue:

1. Candidate discovered.
2. Specs normalized.
3. Score generated.
4. Risks detected.
5. Admin sees candidate card.
6. Admin can approve, reject, edit, merge duplicate, or mark as trusted.
7. Approved item can appear in lists and Chip recommendations.

## Acceptance criteria

- Source adapters are pluggable.
- Amazon and Flipkart logic is not hard-coded into UI.
- Product candidates can be reviewed before public display.
- Missing/stale data is clearly labeled.
- Affiliate URLs are generated centrally.
- Existing product cards continue working.


## Daily scheduled research mode

The Research Agent must support a recurring daily schedule controlled from admin settings. The schedule should use a configurable editorial calendar rather than hard-coded logic.

Default seed calendar:

- Monday: new tech and hardware trends
- Tuesday: software requirements and updates
- Wednesday: course/program laptop guides
- Thursday: deals, price movement, and value picks
- Friday: brand, service, warranty, and trust-building
- Saturday: comparisons and user FAQs
- Sunday: weekly roundup and evergreen planning

For each run, the agent should generate `research_packet` records that can be passed to the Persona-Based Blog Author Agent. Daily post count should be an admin-configured target, not a guaranteed forced output. If good research is not found, the agent should record that clearly and skip draft generation rather than producing weak content.

See `24_RESEARCH_EDITORIAL_CALENDAR_ADMIN_CONFIG.md` for the full configuration model.
