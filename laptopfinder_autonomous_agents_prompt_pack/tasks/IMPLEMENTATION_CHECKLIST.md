# Implementation Checklist

## Before coding

- [ ] Create new branch.
- [ ] Run app locally.
- [ ] Inspect current stack.
- [ ] Inspect product and Chip flows.
- [ ] Inspect blog/CMS flow.
- [ ] Inspect affiliate/analytics handling.
- [ ] Produce investigation report.
- [ ] Ask only post-investigation clarifying questions.

## Foundation

- [ ] Feature flags.
- [ ] Safe mode.
- [ ] Agent settings.
- [ ] Job logs.
- [ ] Source adapter interface.
- [ ] Affiliate resolver interface.

## Research Agent

- [ ] Manual adapter.
- [ ] Amazon adapter scaffold.
- [ ] Flipkart adapter scaffold.
- [ ] Product normalizer.
- [ ] Product scorer.
- [ ] Candidate queue.
- [ ] Admin review.

## Blogging Agent

- [ ] Topic queue.
- [ ] Draft generator.
- [ ] Fact-check checklist.
- [ ] Scheduling controls.
- [ ] Admin review.

## Chip Agent

- [ ] Interaction logging.
- [ ] Need extraction.
- [ ] Preference summary.
- [ ] Reasoned recommendations.
- [ ] Trust-building copy.

## Monetization

- [ ] Central affiliate resolver.
- [ ] Source toggles.
- [ ] Click logging.
- [ ] Disclosure.
- [ ] Ads off by default.

## QA

- [ ] Unit tests.
- [ ] Integration tests.
- [ ] Admin smoke tests.
- [ ] Regression tests.
- [ ] Rollback docs.

## Persona-based blog authoring checklist

- [ ] Investigate current blog author model.
- [ ] Add persona table/schema.
- [ ] Add persona version/snapshot storage.
- [ ] Build admin persona list.
- [ ] Build create/edit persona form.
- [ ] Build disable/archive/remove logic.
- [ ] Add persona preview tool.
- [ ] Add persona selector service.
- [ ] Integrate persona selection with blog drafts.
- [ ] Add author card to public blog post page.
- [ ] Add author archive route where supported.
- [ ] Add audit logs.
- [ ] Add tests for deletion safeguards.
- [ ] Add tests for old post attribution.


## Research Calendar Checklist

- [ ] Seed default weekly research calendar.
- [ ] Build admin calendar UI.
- [ ] Add daily post target configuration.
- [ ] Add scheduler reading DB config.
- [ ] Add run logs.
- [ ] Add research packet model.
- [ ] Connect packets to persona blog author flow.
- [ ] Add pause/run-now controls.
- [ ] Keep auto-publish off by default.
- [ ] Add QA tests for day-wise schedule changes.
