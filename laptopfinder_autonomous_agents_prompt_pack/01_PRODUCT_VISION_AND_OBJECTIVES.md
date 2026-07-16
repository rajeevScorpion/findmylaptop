# Product Vision and Objectives

## Vision

LaptopFinder should become a trusted, useful, self-improving laptop-buying assistant for Indian students, parents, and professionals. The platform should generate organic traffic through helpful content, convert intent through trustworthy guidance, and monetize ethically through affiliate links and ads.

## Primary user promise

Users should feel:

- “I understand what kind of laptop I need.”
- “I know why this laptop fits my course/software/budget.”
- “I can compare Amazon, Flipkart, and other options without confusion.”
- “The recommendation is not random or purely promotional.”
- “Chip is helping me make a confident buying decision.”

## Business goals

1. Increase useful organic traffic through blogs and evergreen buying guides.
2. Increase repeat visits through updated laptop lists and interaction memory.
3. Improve recommendation quality through user interaction learning.
4. Build trust for affiliate buying, especially Amazon, without sounding promotional.
5. Push contextual affiliate links at the right moment.
6. Create future-ready ad placements only where they do not damage trust.

## Product principles

- Help first, monetize second.
- Explain recommendation reasoning clearly.
- Avoid overclaiming exact price/deal unless data is fresh and source-compliant.
- Prefer “Check current price” over stale price display when source freshness is uncertain.
- Separate editorial content from affiliate monetization logic.
- Do not let automation publish low-quality content.
- Let admin review, override, pause, and rollback.

## Agent roles

### Research Agent

Discovers and organizes laptop products.

Outputs:

- Candidate laptop records
- Normalized specs
- Source URLs and affiliate URLs
- Confidence score
- Fit tags: CSE, design, gaming, architecture, animation, video editing, general students, budget users
- Risk notes: weak GPU, soldered RAM, poor thermals, low service confidence, old CPU, misleading seller info
- Review queue items for admin

### Blogging Agent

Finds topics and drafts/schedules content.

Outputs:

- Topic ideas
- Keyword intent notes
- Blog outlines
- Full draft articles
- Internal link suggestions
- Product-card insertion suggestions
- SEO metadata
- Suggested schedule date/time
- Fact-check checklist

### Chip Agent

Learns from user interactions and improves trust/recommendations.

Outputs:

- User intent profile
- Need extraction
- Recommendation reasoning
- Follow-up questions when necessary
- Trust-building explanations
- Contextual affiliate-link suggestions
- Interaction learning signals
- Feedback loop for product scoring and content topics
