# UI/UX Integration

## Product cards

Product cards should show:

- Laptop title
- Normalized key specs
- Fit tags
- Risk notes if important
- “Why this fits” summary
- Source badge: Amazon / Flipkart / Other
- CTA: “Check current price” by default
- Price only when fresh and compliant
- Last updated timestamp when price/availability is shown
- Affiliate disclosure near or linked from CTA

## Comparison lists

Comparison list should support:

- Filter by budget
- Filter by course/use case
- Filter by GPU/CPU/RAM
- Sort by fit score/value score
- Show source options side by side where available

## Blog integration

Blogs should support:

- Inline product cards
- Internal links
- Related Chip prompts
- CTA to ask Chip
- Affiliate disclosure
- “Last updated” timestamp

## Chip integration

Chip should show product recommendations in a structured way:

- Suggested spec direction first
- 1-3 product options max by default
- Explanation before CTA
- Honest warning when a laptop is not ideal
- Link to full comparison/list

## Admin UI

Admin UI should be functional before polished:

- Agent settings page
- Research queue page
- Blog queue page
- Job logs page
- Source status page
- Monetization settings page

## UX copy examples

### Affiliate disclosure

```text
Some links may earn LaptopFinder a commission. The recommendation is based on fit and value first.
```

### Stale price fallback

```text
Price changes often. Open the store page to check the latest price and offers.
```

### Trust message for Amazon

```text
When buying online, verify the exact specs on the product page and again after delivery using system information. Prefer official brand stores or reliable sellers where possible.
```

## Acceptance criteria

- User-facing recommendations do not feel spammy.
- Product cards remain readable on mobile.
- Affiliate links are clear but not aggressive.
- Admin can review generated content easily.
