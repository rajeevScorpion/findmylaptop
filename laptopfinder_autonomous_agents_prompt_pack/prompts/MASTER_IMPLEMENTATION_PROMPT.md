# Master Implementation Prompt

Use this prompt after reading the whole pack.

You are implementing LaptopFinder autonomous growth agents. Start by auditing the existing codebase. Do not assume anything. Do not write feature code before producing an investigation report.

The platform needs:

- Research Agent for laptop discovery from Amazon, Flipkart, and approved sources.
- Blogging Agent for topic discovery, blog drafting, and controlled scheduling.
- Chip Agent learning layer for better recommendations and trust-building.
- Central affiliate link resolver and click tracking.
- Admin controls for automation, sources, review, publishing, and monetization.

Constraints:

- Existing flows must not break.
- Use feature flags and safe mode.
- Work in phases.
- Commit after each meaningful phase.
- Keep credentials server-side.
- Use official/approved APIs and lawful source access only.
- Keep all generated products/blogs in review mode first.
- Ask clarifying questions only after investigation, with recommended options.

Deliver first:

1. Codebase audit.
2. API/source feasibility audit.
3. Architecture recommendation.
4. Implementation phase plan.
5. Clarifying questions.
6. Risk/rollback notes.

Stop after this first deliverable unless told to proceed.

## Persona authoring requirement

Include Phase 03A for Persona-Based Blog Author Agent and Persona Management Tool. Personas must be manageable from admin and displayed as public authors on blog posts they write. Do not hardcode personas only in prompts.


## Must include: Research Calendar

Implement the Research Agent schedule as an admin-configurable editorial calendar. Seed the weekly plan, but allow admin to change all day-wise themes and post targets. Daily post count is a goal, not a forced publish rule. Generated research packets should feed the Persona-Based Blog Author Agent. Use `PHASE_02A_RESEARCH_CALENDAR_PROMPT.md` for this part.
