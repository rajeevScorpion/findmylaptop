# Edge Cases, Risks, and Rollback

## Edge cases

### Source/API issues

- Amazon API access unavailable.
- Flipkart token invalidated.
- API returns incomplete specs.
- Price/availability stale.
- Source rate limit reached.
- Product URL changes.
- Duplicate product appears across sources.
- Seller/store reliability unknown.

### Product data issues

- Title contains misleading specs.
- GPU wattage missing.
- RAM soldered but not clearly mentioned.
- Same model has multiple configurations.
- Product image does not match specs.
- Price suddenly drops/spikes.

### Blog issues

- Generated blog repeats old topics.
- Blog contains unsupported claim.
- Product suggestions become stale before publish.
- AI-generated article sounds promotional or generic.
- Internal links point to missing pages.

### Chip issues

- User gives vague requirement.
- User asks for “best laptop” without budget.
- User asks for unrealistic budget/spec combination.
- Chip over-recommends expensive gaming laptops.
- Chip pushes affiliate links too early.
- User rejects online buying.

### Monetization issues

- Affiliate URL not tagged correctly.
- Commission not attributed.
- User clicks but buys elsewhere.
- Ads reduce trust or performance.
- Source policy changes.

## Workarounds

- Use manual/CSV product import fallback.
- Use “Check current price” instead of stale price.
- Add admin notes for uncertain specs.
- Use model-family deduplication.
- Keep user-facing recommendations to 1-3 products.
- Keep blogs in draft until reviewed.
- Disable source instantly through admin settings.

## Rollback plan

Every phase must be rollback-safe.

- Feature flags should disable new behavior without removing code.
- Database migrations should have down/rollback notes where possible.
- Scheduler should be disabled by env/admin flag.
- Affiliate resolver should fall back to normal product URL if source is disabled.
- Blog auto-publish must be off by default.
- Chip learning can be disabled while preserving chat.

## Emergency kill switches

Add env/admin kill switches:

```text
AGENTS_ENABLED=false
RESEARCH_AGENT_ENABLED=false
BLOGGING_AGENT_ENABLED=false
CHIP_LEARNING_ENABLED=false
AFFILIATE_LINKS_ENABLED=false
ADS_ENABLED=false
AGENT_SAFE_MODE=true
```

## Persona risks and safeguards

Risks:

- Fictional personas could be mistaken for real humans.
- Persona edits could unintentionally change old author attribution.
- Auto-selected persona may be mismatched to topic.
- Too many personas may create inconsistent brand trust.
- Affiliate-heavy persona writing may feel biased.

Safeguards:

- Mark AI/editorial personas clearly in public author profiles.
- Store persona snapshots with published posts.
- Allow admin override before publishing.
- Require manual review for new personas until trusted.
- Enforce affiliate disclosure per persona and per post.
- Maintain a default LaptopFinder Editorial Guide persona.

Rollback:

- Disable persona mode globally.
- Disable individual personas.
- Revert blog generation to default Blogging Agent voice.
- Keep old posts readable using stored author snapshots.
