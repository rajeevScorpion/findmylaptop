# API and Service Layer

## Principle

Keep agent logic server-side. Do not place API credentials, prompts, source tokens, or affiliate generation logic in client components.

## Suggested services

```text
/services/agents/orchestrator.ts
/services/agents/researchAgent.ts
/services/agents/bloggingAgent.ts
/services/agents/chipLearningAgent.ts
/services/sources/sourceAdapterRegistry.ts
/services/sources/amazonAdapter.ts
/services/sources/flipkartAdapter.ts
/services/sources/manualSourceAdapter.ts
/services/products/productNormalizer.ts
/services/products/productScorer.ts
/services/affiliate/affiliateLinkResolver.ts
/services/blog/blogDraftService.ts
/services/chip/interactionLogger.ts
/services/chip/recommendationMemory.ts
/services/admin/agentSettingsService.ts
```

Adapt paths to current project structure.

## API endpoints / server actions

Suggested endpoints only if compatible:

- `GET /api/admin/agents/settings`
- `POST /api/admin/agents/settings`
- `POST /api/admin/agents/run`
- `GET /api/admin/research-queue`
- `POST /api/admin/research-queue/:id/approve`
- `POST /api/admin/research-queue/:id/reject`
- `GET /api/admin/blog-queue`
- `POST /api/admin/blog-queue/:id/generate-draft`
- `POST /api/admin/blog-queue/:id/schedule`
- `POST /api/affiliate/resolve`
- `POST /api/events/chip-interaction`
- `POST /api/events/affiliate-click`

## Error handling

Every service should return typed errors:

- `SOURCE_AUTH_ERROR`
- `SOURCE_RATE_LIMITED`
- `SOURCE_UNAVAILABLE`
- `PRODUCT_NORMALIZATION_FAILED`
- `COMPLIANCE_BLOCKED`
- `LLM_GENERATION_FAILED`
- `ADMIN_APPROVAL_REQUIRED`
- `AFFILIATE_RESOLUTION_FAILED`

## Acceptance criteria

- Existing pages and APIs remain compatible.
- Credentials remain server-side.
- UI calls service endpoints rather than external APIs directly.
- Errors are visible in admin logs.
