# Agent Orchestrator

## Purpose

The Agent Orchestrator controls when and how the Research, Blogging, and Chip learning agents run. It must enforce admin settings, feature flags, rate limits, source permissions, and safety checks.

## Responsibilities

- Read admin settings.
- Read environment configuration.
- Start scheduled jobs.
- Prevent overlapping jobs.
- Route tasks to agents.
- Store job logs and errors.
- Retry safe failures.
- Stop unsafe tasks.
- Keep all actions auditable.

## Job types

1. `research.discover_laptops`
2. `research.refresh_product_data`
3. `research.score_candidates`
4. `blog.discover_topics`
5. `blog.generate_draft`
6. `blog.schedule_approved_post`
7. `chip.summarize_interactions`
8. `chip.update_recommendation_rules`
9. `monetization.resolve_affiliate_links`
10. `analytics.generate_growth_insights`

## Guardrails

- No production publish unless admin setting allows it.
- No product publicly listed without minimum confidence score.
- No affiliate link shown without source and disclosure rules.
- No generated blog published unless it passes fact-check, plagiarism check if available, and admin policy.
- No user-level memory should store sensitive data unless explicitly needed and disclosed.

## Suggested orchestrator pseudocode

```ts
async function runAgentJob(jobType: AgentJobType, payload: unknown) {
  const settings = await getAgentSettings();
  await assertJobAllowed(jobType, settings);
  const lock = await acquireJobLock(jobType);

  try {
    await logJobStart(jobType, payload);
    const result = await dispatchJob(jobType, payload, settings);
    await logJobSuccess(jobType, result);
    return result;
  } catch (error) {
    await logJobFailure(jobType, error);
    await notifyAdminIfNeeded(jobType, error);
    throw error;
  } finally {
    await releaseJobLock(lock);
  }
}
```

## Implementation instruction

Use the current app’s scheduling/job pattern if it already exists. If it does not exist, implement the smallest safe scheduler compatible with the deployment environment.
