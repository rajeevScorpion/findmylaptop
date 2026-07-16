# Phase 02A Prompt — Admin-Configurable Research Calendar

You are implementing the LaptopFinder Research Agent daily schedule and admin-configurable editorial calendar.

## Mandatory first step

Inspect the current platform stack, blog/CMS implementation, existing admin panel, auth/roles, background job scheduler, database schema, environment variables, and any current cron/worker setup. Do not assume a framework.

## Goal

Create a configurable system where the Research Agent can run daily according to admin-defined themes and post targets.

Default seed schedule:

- Monday: new tech and hardware trends
- Tuesday: software requirements and updates
- Wednesday: course/program laptop guides
- Thursday: deals, price movement, and value picks
- Friday: brand/service/warranty/trust-building content
- Saturday: comparisons and user FAQs
- Sunday: weekly roundup and evergreen planning

This default schedule must be editable by admin. Do not hard-code the schedule into agent logic.

## Build requirements

1. Add a database model/table for research editorial calendar configuration.
2. Add a database model/table for research schedule runs.
3. Add a database model/table for research packets if not already present.
4. Add admin UI under Growth Agents > Research Calendar.
5. Allow admin to configure:
   - Active days
   - Run time
   - Timezone
   - Theme name and description
   - Keywords
   - Target audience
   - Preferred personas
   - Source priority
   - Minimum, target, and maximum daily post count
   - Draft-only / approval-required / auto-schedule / controlled auto-publish mode
   - Affiliate insertion mode
   - Maximum product cards per post
   - Minimum research confidence and blog quality score
   - Manual pause and run-now controls
6. Connect the scheduler to the Research Agent.
7. Ensure generated research packets can be consumed by the Persona-Based Blog Author Agent.
8. Add logs, error handling, and admin notifications.

## Safety rules

- Start in draft-only mode.
- Do not auto-publish by default.
- Do not force low-quality daily posts just to satisfy a target count.
- If research quality is low, create a `no_good_topic_found` run result and notify admin.
- If source/API fails, do not silently publish stale content.
- Use feature flags.
- Keep all credentials in environment variables or existing secret management.

## Acceptance tests

- Admin can change Monday from “new tech” to another theme without code changes.
- Admin can set Tuesday post target to 2 and Wednesday target to 0.
- Research Agent runs only on enabled days.
- Research Agent records run status and generated packet count.
- Blog Writer receives research packets with suggested persona and content type.
- Paused agent does not run.
- Run-now button works without changing the recurring schedule.
- Auto-publish remains off by default.
