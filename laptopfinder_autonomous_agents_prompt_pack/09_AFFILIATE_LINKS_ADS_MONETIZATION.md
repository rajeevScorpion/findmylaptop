# Affiliate Links, Ads, and Monetization

## Principle

Monetization must not damage trust. LaptopFinder should recommend what fits, then offer contextual purchase paths.

## Affiliate link strategy

Use a centralized Affiliate Link Resolver.

Responsibilities:

- Generate affiliate URLs by source.
- Append tracking IDs correctly.
- Log clicks.
- Store source, placement, page, user/session context, and timestamp.
- Respect source-specific policies.
- Avoid exposing API tokens client-side.
- Support non-affiliate fallback URLs.

## Affiliate placements

Allowed placements:

- Product cards
- Comparison tables
- Blog product sections
- Chip recommendation response
- “Where to buy” section
- Admin-approved deal pages

Avoid:

- Excessive links in every paragraph
- Misleading “best price” claims
- Fake urgency
- Incentives for clicking affiliate links if prohibited
- Any purchase recommendation solely based on commission

## Amazon-specific safety notes

- Investigate current Creators API requirements and India Associates requirements before coding.
- If using current API data for price/availability, store fetch timestamp.
- Show required timestamp/disclaimer where needed.
- If not using fresh compliant price data, use “Check current price on Amazon”.
- Do not cache or display Amazon content beyond allowed limits.

## Flipkart-specific safety notes

- Use affiliate ID and token server-side.
- Validate whether product feed URLs returned by Flipkart already include tracking ID.
- Confirm allowed cache duration and display rules from current terms.
- Build fallback for API token failure.

## Ads strategy

Ads should come later than affiliate foundation.

Admin controls:

- Ads enabled/disabled globally.
- Ads enabled/disabled by page type.
- Max ad density.
- Block ads inside Chip answer until trust is stable.
- Separate ad analytics from recommendation quality.

## Click analytics events

Track:

- `affiliate_link_rendered`
- `affiliate_link_clicked`
- `product_card_viewed`
- `comparison_clicked`
- `chip_recommendation_clicked`
- `blog_product_card_clicked`
- `external_purchase_intent`

## Disclosures

Place clear disclosure near monetized links:

```text
LaptopFinder may earn a commission when you buy through some links. Recommendations are based on fit, specs, and value—not only commission.
```

## Acceptance criteria

- All affiliate links go through one resolver.
- Admin can disable affiliate links by source.
- Click tracking works without leaking personal data.
- Price freshness and source compliance are enforced.
- Ads are feature-flagged and off by default for MVP.
