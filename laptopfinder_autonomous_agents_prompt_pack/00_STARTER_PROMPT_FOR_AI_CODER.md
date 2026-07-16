# Starter Prompt for AI Coder

You are working on the existing LaptopFinder platform. Your task is to build and integrate an autonomous growth-agent system, but you must begin with investigation. Do not assume the stack, database schema, routes, CMS/blog system, cron setup, existing Chip architecture, affiliate-link format, auth model, or analytics setup.

## Product objective

LaptopFinder should become more autonomous in discovering useful laptop options, publishing helpful laptop-buying content, learning from user interactions, increasing trust, and eventually monetizing through contextual affiliate links and ads.

The system will include three core agents:

1. **Research Agent**
   - Finds laptops from Amazon, Flipkart, and other approved online sources.
   - Normalizes product data.
   - Scores and lists laptops by user type, budget, course/program, software need, GPU/CPU/RAM/SSD, thermals, serviceability, and value.
   - Must support draft/review mode before public listing.

2. **Blogging Agent**
   - Finds hot topics around laptop buying, student needs, courses, GPUs, CPUs, design/CSE/software requirements, offers, common confusion, and seasonal buying windows.
   - Writes helpful articles in LaptopFinder's tone.
   - Schedules blogs after admin approval or configured auto-publish rules.
   - Must never publish misleading specs, stale prices, unsupported claims, or thin SEO spam.

3. **Chip Agent**
   - Learns from user interactions to improve suggestions.
   - Builds user trust over time by explaining why a laptop fits or does not fit.
   - Helps users feel confident buying from Amazon or other affiliate sources without sounding pushy.
   - Uses contextual affiliate links only when useful and transparent.

## Hard rules

- Create a new branch before implementation.
- Inspect the current codebase first.
- Produce an investigation report before writing feature code.
- Ask clarifying questions only after investigation, and make those questions practical with recommended options.
- Work in meaningful phases and commit after each phase.
- Nothing already working should break.
- Add feature flags so each agent can be enabled/disabled independently.
- Add admin controls for source inclusion/exclusion, auto-publish rules, confidence thresholds, review requirements, and monetization settings.
- Do not scrape marketplace pages unless allowed by their terms. Use official APIs, approved feeds, affiliate-network APIs, or manual imports.
- Amazon integration must be investigated against the current Amazon Creators API / affiliate program requirements, not blindly built against old PA-API examples.
- Flipkart integration must be investigated using current affiliate token/API availability before implementation.
- All credentials must use environment variables and secure server-side storage.
- Never expose affiliate API tokens or LLM keys to the browser.

## First task

Before coding, produce:

1. Current stack summary.
2. Existing product/laptop data model summary.
3. Existing Chip/recommendation flow summary.
4. Existing blog/CMS flow summary.
5. Existing affiliate-link/analytics handling summary.
6. Current auth/admin model summary.
7. Recommended implementation phases.
8. Clarifying questions that remain after investigation.

Stop after the investigation report unless the user explicitly asks you to proceed.

## Additional module: persona-based blog authors

Also implement a Persona-Based Blog Author Agent and Persona Management Tool.

Personas must be displayed as public blog authors on the posts they write. Admin must be able to define, create, edit, preview, disable, archive, remove, and restore personas. Persona-written posts must store persona ID, persona version, author type, and a persona snapshot so old posts do not break when a persona changes.

Treat fictional personas as LaptopFinder editorial/expert personas and disclose them clearly. Do not invent fake real-world credentials.


## Additional requirement: Daily Research Calendar

Implement the Research Agent as a scheduled system, not a manual-only feature. Seed the default weekly calendar as:

- Monday: new tech and hardware trends
- Tuesday: software requirements and updates
- Wednesday: course/program laptop guides
- Thursday: deals, price movement, and value picks
- Friday: brand/service/warranty/trust-building content
- Saturday: comparisons and user FAQs
- Sunday: weekly roundup and evergreen planning

This schedule and the daily post target must be configurable by admin. Do not hard-code it in the agent logic. Start with draft-only mode and require admin approval before publishing unless the admin explicitly enables a safer automation mode. Read `24_RESEARCH_EDITORIAL_CALENDAR_ADMIN_CONFIG.md` and `prompts/PHASE_02A_RESEARCH_CALENDAR_PROMPT.md` before implementation.
