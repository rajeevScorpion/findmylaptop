# Changelog — Research Calendar Update

Date: 2026-07-02

## Added

- Daily Research Agent schedule requirement.
- Default weekly editorial/research calendar:
  - Monday: new tech
  - Tuesday: software
  - Wednesday: course/program guides
  - Thursday: deals/value picks
  - Friday: brand/service/trust
  - Saturday: comparisons/user FAQs
  - Sunday: weekly roundup/evergreen planning
- Admin-configurable daily post count.
- Admin controls for day-wise themes, source priority, personas, and automation mode.
- Research packet workflow connecting Research Agent to Persona-Based Blog Author Agent.
- Schema: `schemas/research_editorial_calendar.schema.json`.
- Implementation prompt: `prompts/PHASE_02A_RESEARCH_CALENDAR_PROMPT.md`.

## Updated implementation expectation

The Research Agent should run on a daily schedule but must remain admin-controlled. The platform must support a safe draft-first mode and should not publish content merely because a post target exists.
