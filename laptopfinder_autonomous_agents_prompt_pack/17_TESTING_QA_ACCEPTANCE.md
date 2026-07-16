# Testing, QA, and Acceptance Criteria

## Test categories

### Unit tests

- Product normalizer
- Product scorer
- Source adapter interface
- Affiliate link resolver
- Admin settings service
- Chip need extraction
- Blog prompt builders

### Integration tests

- Research job creates candidate but does not publish.
- Admin approves candidate and product becomes available.
- Blog topic becomes draft but not published.
- Affiliate link resolver logs click event.
- Chip logs interaction without breaking chat response.
- Safe mode prevents all publish/approve actions.

### UI tests

- Admin settings load/save.
- Research queue approve/reject works.
- Blog queue draft/schedule works.
- Product card displays CTA and disclosure.
- Mobile product card remains readable.

### Compliance tests

- Price display requires timestamp/freshness.
- Missing/stale price falls back to “Check current price”.
- No API tokens appear in frontend bundle.
- Source disabled means no new fetches and no new links from that source.
- Affiliate disclosure appears where required.

### Regression tests

- Existing laptop search still works.
- Existing Chip chat still works.
- Existing product pages still work.
- Existing blog pages still work, if present.
- Existing admin auth still works.

## Acceptance criteria for MVP

The MVP is accepted when:

1. Admin can enable/disable each agent.
2. Research Agent can create product candidates in draft/review mode.
3. Product candidates can be approved or rejected.
4. Blogging Agent can create topic/draft items without auto-publishing.
5. Chip can log interaction signals and improve response reasoning using approved products.
6. Affiliate links are generated centrally and logged.
7. Price/availability display is safe and freshness-aware.
8. Scheduler can run in safe mode.
9. Job logs show success/failure.
10. Existing platform functionality is not broken.

## Manual QA checklist

- [ ] Toggle Research Agent off and confirm no research jobs run.
- [ ] Run Research Agent manually and confirm candidate appears in queue.
- [ ] Approve a candidate and confirm it can appear in product list.
- [ ] Reject a candidate and confirm it does not appear publicly.
- [ ] Generate a blog topic and draft.
- [ ] Confirm draft is not published automatically.
- [ ] Ask Chip for a laptop recommendation and verify response explains fit.
- [ ] Click affiliate CTA and verify event logging.
- [ ] Disable Amazon source and verify Amazon links do not render newly.
- [ ] Enable safe mode and verify no publishing/approvals happen automatically.

## Persona management and persona authoring tests

Test cases:

1. Admin creates a new AI/editorial persona.
2. Admin edits persona bio and prompt; version increments.
3. Admin previews persona output for a topic.
4. Persona selector chooses design professor persona for design software topic.
5. Persona selector chooses native app developer persona for Android/iOS development topic.
6. Admin overrides selected persona before draft generation.
7. Draft stores `authorPersonaId`, `authorPersonaVersion`, and selection reason.
8. Published post displays persona author card.
9. Author archive page lists posts by persona.
10. Disabled persona cannot be selected for new drafts.
11. Archived persona remains visible on old published posts.
12. Hard delete is blocked when published posts depend on the persona.
13. Fictional/AI persona displays required editorial disclosure.
14. Existing non-persona posts still render correctly.


## Research calendar QA

- Admin can edit each weekday theme.
- Admin can set daily post target per day.
- Disabled days do not run.
- Paused scheduler does not run.
- Manual run-now creates a schedule run record.
- Low-confidence research produces no blog draft and logs a reason.
- Research packet handoff contains suggested persona and content type.
- Auto-publish is disabled by default.
- Changing schedule does not require deployment.
