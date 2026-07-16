# Research Notes and Official Docs

These notes are included so the AI coder starts from current source reality instead of outdated assumptions. Verify again during implementation.

## Amazon

Official PA-API 5.0 documentation currently states:

- PA-API will be deprecated on May 15, 2026.
- The PA-API documentation site says it is no longer maintained and contains outdated information.
- It instructs new customers to onboard to Creators API.
- Offers is deprecated and OffersV2 should be used where relevant.

Official references to verify:

- https://webservices.amazon.com/paapi5/documentation/register-for-pa-api.html
- https://affiliate-program.amazon.com/creatorsapi/docs/
- https://affiliate-program.amazon.in/help/operating/agreement

Important Amazon Associates operating points to verify for India:

- Mobile application/site requirements.
- Session/qualifying purchase rules.
- Rules for displaying price and availability.
- Timestamp/disclaimer requirements.
- Cache limits for product advertising content.
- API rate limits.
- Current Creators API eligibility and usage rules.

Implementation note:

Do not build new Amazon integration only on old PA-API examples. Build an adapter that can support Creators API or a manual fallback depending on account access.

## Flipkart

Official Flipkart Affiliate API docs state:

- Registered affiliates can access affiliate APIs.
- APIs include product, offer, and report use cases.
- API formats include JSON and XML over HTTPS.
- API access uses headers: `Fk-Affiliate-Id` and `Fk-Affiliate-Token`.
- Generating a new token disables the old one.
- API status can be checked in the affiliate dashboard.

Official references to verify:

- https://affiliate.flipkart.com/api-docs/af_overview.html
- https://affiliate.flipkart.com/api-docs/af_register.html
- https://affiliate.flipkart.com/api-docs/af_prod_ref.html
- https://affiliate.flipkart.com/commissions

Implementation note:

Build Flipkart as one source adapter. Do not assume every feed contains all laptop specs cleanly. Normalize, score, and send uncertain items to admin review.

## Other sources

Add other sources only when:

- Source terms allow product data usage.
- Affiliate tracking is supported or source is manually curated.
- Data freshness and attribution rules are clear.
- Admin can disable the source.

## Compliance-first CTA strategy

When in doubt:

- Do not show exact price.
- Show “Check current price”.
- Show source and last updated time if data is displayed.
- Keep affiliate disclosure visible.
