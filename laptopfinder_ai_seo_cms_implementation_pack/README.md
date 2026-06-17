# LaptopFinder.cc AI SEO CMS Implementation Pack

This folder contains implementation instructions for adding an AI-assisted SEO blog/CMS system inside LaptopFinder.cc.

The intended outcome is **not** an automatic AI blog spam tool. The intended outcome is a safe, admin-controlled, SEO-aware publishing workflow:

**Admin inputs topic/brief → AI generates structured draft → Admin reviews/edits → Admin publishes → Blog page renders with modern SEO layout → Sitemap and metadata update.**

## Mandatory working principles

The AI coder must:

1. **Create a new branch before implementation.**
2. **Inspect the existing codebase first. Do not assume framework, routes, database, auth, design system, or deployment setup.**
3. **Ground every implementation decision, API call, route, component, schema, and migration in the existing codebase.**
4. **Do not break existing working flows.**
5. **Commit after meaningful steps with clear progressive commit messages.**
6. **Resolve conflicts gracefully and never overwrite unrelated work without review.**
7. **Add admin feature toggles so the blog/CMS/AI writer can be enabled or disabled safely.**
8. **Ask clarifying questions where the codebase or product intent is ambiguous.**
9. **Keep AI-generated content in draft/review mode by default. Never auto-publish AI output.**
10. **Avoid hallucinated laptop specs, prices, reviews, ratings, and availability. Product facts must come from the LaptopFinder database or verified admin input.**

## Suggested execution order

1. Read `00_STARTER_PROMPT_FOR_AI_CODER.md`.
2. Follow `01_CODEBASE_DISCOVERY_AND_SAFETY.md`.
3. Implement in phases using `02_IMPLEMENTATION_ROADMAP.md`.
4. Use the schema guidance in `03_DATABASE_AND_CONTENT_MODEL.md`.
5. Build the AI service according to `04_OPENAI_AI_WRITER_SERVICE.md`.
6. Build admin UI from `05_ADMIN_CMS_UI_SPEC.md`.
7. Build rendering/design system from `06_PUBLIC_BLOG_RENDERING_SPEC.md`.
8. Add SEO from `07_SEO_METADATA_SITEMAP_SCHEMA.md`.
9. Add feature toggles from `08_FEATURE_FLAGS_AND_ADMIN_CONTROLS.md`.
10. Add product-card provision from `09_PRODUCT_CARD_BLOCKS_FUTURE_PROVISION.md`.
11. Secure and test using `10_SECURITY_PERMISSIONS_RATE_LIMITS.md` and `11_TESTING_QA_ACCEPTANCE.md`.
12. Use `12_DEPLOYMENT_ROLLBACK_OBSERVABILITY.md` before merging.
13. Use `13_AI_PROMPTS_AND_JSON_SCHEMAS.md` as prompt/schema reference.
14. Use `14_COMMIT_PLAN_AND_PROGRESS_NOTES.md` for progressive commits.
15. Use `15_FINAL_HANDOFF_CHECKLIST.md` before final delivery.

## MVP scope

The MVP should include:

- Admin-only post list
- Create/edit blog post
- Draft/review/published states
- AI outline generation
- AI full draft generation
- Rich text or structured block editor
- Slug/meta generation
- Public blog index and post pages
- TOC with anchor links
- SEO-friendly metadata
- FAQ block and FAQ schema
- Article schema and breadcrumbs
- Dynamic sitemap inclusion
- Admin feature toggles
- Safe logging of AI calls without storing secrets

## Deferred scope

Do not force these into MVP unless already supported by the codebase:

- Bulk generation with Batch API
- Automatic product insertion
- AI image generation
- Multi-author editorial workflow
- Full version history UI
- Google Search Console API integration
- Automatic refresh of old posts
