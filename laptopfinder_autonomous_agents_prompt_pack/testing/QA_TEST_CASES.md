# QA Test Cases

## Research Agent

1. Run with all sources disabled → job skips and logs reason.
2. Run with manual source only → candidate created in pending review.
3. Candidate with missing GPU → marked unknown and risk tag added.
4. Candidate with stale price → CTA uses check-current-price fallback.
5. Admin approves candidate → appears as approved product.
6. Admin rejects candidate → never appears publicly.

## Blogging Agent

1. Generate topic from seed → topic queue item created.
2. Generate draft → draft saved but unpublished.
3. Draft with product suggestions → only approved products used.
4. Auto-publish disabled → schedule/publish blocked.
5. Fact-check failure → draft stays in review.

## Chip Agent

1. User asks vague query → Chip asks focused follow-up.
2. User gives budget/course → Chip suggests spec direction.
3. Approved product exists → Chip explains why it fits.
4. Product has risk tag → Chip mentions trade-off.
5. Affiliate links disabled → Chip gives advice without store links.
6. Learning disabled → chat works, no new learning events stored.

## Monetization

1. Affiliate click logs placement and source.
2. Disabled source does not generate link.
3. API token missing does not crash UI.
4. Disclosure visible near monetized CTA.
5. No frontend bundle contains secret tokens.
