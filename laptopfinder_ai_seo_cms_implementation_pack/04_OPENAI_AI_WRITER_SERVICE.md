# 04 — OpenAI AI Writer Service

## Purpose

Create a server-side AI writing service to help admins generate SEO-friendly blog drafts.

## Current API recommendation

Use the OpenAI Responses API for new text generation work if compatible with the existing codebase. If the project already has a working OpenAI abstraction, extend it safely instead of creating a duplicate client.

## Mandatory safety rule

The AI writer must never publish directly.

Allowed:

```text
AI generates outline -> admin reviews
AI generates draft -> saved as draft/review
AI improves section -> admin accepts
AI generates metadata -> admin can edit
```

Not allowed:

```text
AI generates post -> instantly public
AI invents product specs/prices/reviews
AI creates fake ratings
AI adds affiliate claims not grounded in data
```

## Environment variables

Check existing naming conventions first. Possible variables:

```env
OPENAI_API_KEY=
OPENAI_BLOG_WRITER_MODEL=
OPENAI_BLOG_WRITER_ENABLED=
```

If adding environment variables, update `.env.example` or equivalent.

## Recommended service functions

Create server-only functions similar to:

```ts
generateBlogOutline(input)
generateBlogDraft(input)
generateBlogMetadata(input)
improveBlogSection(input)
generateBlogFaqs(input)
validateGeneratedBlogDraft(output)
```

Actual file location must follow the codebase pattern, for example:

```text
lib/ai/blog-writer.ts
src/lib/ai/blog-writer.ts
app/api/admin/blog/ai/generate/route.ts
```

Do not invent paths without codebase inspection.

## Generation steps

### Step 1 — Generate outline

Input:

```json
{
  "topic": "Best laptop for B.Tech CSE students under ₹60,000",
  "brief": "Target Indian students and parents. Use simple language.",
  "audience": ["students", "parents"],
  "primaryKeyword": "best laptop for B.Tech CSE students",
  "secondaryKeywords": ["laptop for coding students", "laptop under 60000"],
  "templateType": "course_buying_guide"
}
```

Output:

```json
{
  "title": "...",
  "slug": "...",
  "searchIntent": "...",
  "audienceNotes": "...",
  "outline": [
    {
      "heading": "...",
      "purpose": "...",
      "keyPoints": ["..."]
    }
  ],
  "suggestedInternalLinks": [
    {
      "anchor": "...",
      "href": "..."
    }
  ],
  "productBlockSuggestions": [
    {
      "placementAfterHeading": "...",
      "filterIntent": "coding_under_60000",
      "notes": "Use real product data only."
    }
  ]
}
```

### Step 2 — Generate draft

Generate structured content matching the content block schema.

The model should return JSON, not raw prose only.

### Step 3 — Validate

Validation must check:

- Required fields present
- No invalid enum values
- Slug format
- Meta title length
- Meta description length
- H2 sections present
- FAQ exists where required
- CTA exists
- No product facts unless provided by input data
- No fake ratings/reviews
- No hidden schema data that is not visible on page

## Prompt caching optimization

Put stable system instructions, brand rules, schema, and examples at the beginning of the prompt. Put variable admin inputs at the end. This improves cache compatibility.

Stable prefix should include:

- LaptopFinder brand rules
- Content safety rules
- SEO formatting rules
- Output JSON schema
- Examples

Variable end should include:

- topic
- brief
- keywords
- audience
- template type
- optional product data

## Batch API

Do not implement Batch API in MVP unless requested.

Use it later for:

- Refreshing metadata across many posts
- Generating multiple outlines
- Updating old FAQs
- Bulk rewriting excerpts
- Bulk schema generation

Batch is not ideal for interactive admin generation because the admin expects immediate feedback.

## Prompt versioning

Store a prompt version constant:

```ts
const BLOG_WRITER_PROMPT_VERSION = "2026-06-v1";
```

Log it in `ai_generation_logs`.

## Cost and usage logging

Log safely:

```text
model
generation_type
prompt_version
input topic
status
duration
usage tokens if returned
cached tokens if returned
error message if any
```

Do not log:

```text
OPENAI_API_KEY
authorization headers
raw secrets
private unrelated user data
```

## Error handling

Show friendly admin messages:

- "AI writer is disabled by admin."
- "Draft generation failed. Please retry or edit manually."
- "The generated response did not match the expected format."
- "OpenAI API key is missing on server."
- "Rate limit reached. Try again later."

## Grounding product facts

If product data is included in input, the model may discuss only those products.

If product data is not included, the model must use placeholders:

```text
[Insert product cards from LaptopFinder database here]
```

or content block:

```json
{
  "type": "product_grid_placeholder",
  "data": {
    "filterIntent": "coding_under_60000",
    "limit": 4
  }
}
```

## Moderation/content safety

Laptop buying content is generally low-risk, but still protect against:

- spam generation
- malicious prompt injection in admin input
- off-topic content
- fake claims
- misleading affiliate claims
- competitor defamation

Admin input should be treated as untrusted text. Do not allow admin prompt to override system safety rules.
