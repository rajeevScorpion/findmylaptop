# LaptopFinder Autonomous Growth Agents — AI Coder Prompt Pack

Date: 2026-07-02
Platform: laptopfinder.cc
Purpose: Build an autonomous-but-controlled growth layer for LaptopFinder using configurable research schedules, persona authors, and three major agents:

1. **Research Agent** — discovers laptop options from Amazon, Flipkart, and other approved online sources, normalizes the data, scores products, and prepares useful lists.
2. **Blogging Agent** — discovers hot topics, writes helpful laptop-buying articles, and schedules them after configured review/approval rules.
3. **Chip Agent** — improves laptop recommendation quality by learning from user interactions, building trust, and guiding users toward confident buying decisions through contextual affiliate links and future ads.

This pack is intended to be given to an AI coder. It is not a single blind implementation prompt. It is an investigation-first implementation handoff.

## Non-negotiable implementation rules

- Do not assume the current stack, database schema, deployment setup, auth system, CMS/blog system, or existing Chip flow.
- First inspect the codebase, data models, routes, services, environment variables, analytics setup, and current affiliate-link handling.
- Create a new branch before implementation.
- Work in meaningful feature phases.
- Commit after each meaningful phase with clear commit messages.
- Nothing currently working should break.
- Use feature flags for every major agent capability.
- Never hard-code affiliate credentials, API tokens, tracking IDs, cron secrets, admin IDs, or LLM keys.
- Do not scrape Amazon, Flipkart, or any other marketplace unless the source explicitly permits that use. Prefer official APIs, approved affiliate feeds, manually curated sources, or partner/affiliate-network APIs.
- Ask practical clarifying questions only after codebase and API capability investigation.
- Add rollback notes and tests before enabling autonomous behavior in production.
- Start with admin-controlled draft/review mode. Do not publish or send monetized recommendations fully automatically until admin approval rules are configured.

## Recommended reading order

1. `00_STARTER_PROMPT_FOR_AI_CODER.md`
2. `01_PRODUCT_VISION_AND_OBJECTIVES.md`
3. `02_INVESTIGATE_FIRST_CODEBASE_AND_API_AUDIT.md`
4. `03_CLARIFY_AFTER_INVESTIGATION.md`
5. `04_SYSTEM_ARCHITECTURE.md`
6. `05_AGENT_ORCHESTRATOR.md`
7. Agent-specific specs: `06`, `07`, `08`, plus calendar/persona specs `22`, `23`, `24`
8. Monetization/admin/data/testing/phase files: `09` onward
9. `prompts/MASTER_IMPLEMENTATION_PROMPT.md`

## Target delivery style

Build a safe foundation first:

- Phase 1: codebase + API audit, no product behavior changes
- Phase 2: data models, source adapters, admin settings, logging
- Phase 3: Research Agent in draft mode with admin-configurable daily research calendar
- Phase 4: Blogging Agent in draft/scheduled-review mode
- Phase 5: Chip learning memory + recommendation reasoning layer
- Phase 6: monetization, analytics, A/B tests, safe automation
- Phase 7: hardening, monitoring, rollback, docs

## Added: Persona-based blog authors

This pack now includes a dedicated Persona-Based Blog Author Agent and Persona Management Tool.

Key files:

- `22_PERSONA_BASED_BLOG_AUTHOR_AGENT.md`
- `23_PERSONA_MANAGEMENT_TOOL.md`
- `schemas/blog_author_persona.schema.json`
- `prompts/PHASE_03A_PERSONA_AUTHOR_AGENT_PROMPT.md`

The feature makes personas first-class blog authors, supports admin-managed CRUD, and requires public author attribution/disclosure on persona-written posts.

## Added: Admin-configurable research calendar

This pack now includes a daily Research Agent calendar and schedule configuration layer.

Key files:

- `24_RESEARCH_EDITORIAL_CALENDAR_ADMIN_CONFIG.md`
- `schemas/research_editorial_calendar.schema.json`
- `prompts/PHASE_02A_RESEARCH_CALENDAR_PROMPT.md`

The Research Agent should run daily based on admin-configured themes such as Monday new tech, Tuesday software, and so on. Daily post count, source priority, personas, and publishing mode must be editable by admin.
