# Database Schema and Event Logging

Do not blindly create these tables. First inspect the existing database and adapt naming, ORM, and migration style.

## Suggested tables/collections

### agent_settings

Stores admin-configurable settings.

Fields:

- id
- key
- value_json
- updated_by
- updated_at

### agent_jobs

Stores background job runs.

Fields:

- id
- job_type
- status: queued/running/succeeded/failed/cancelled
- payload_json
- result_json
- error_message
- started_at
- finished_at
- created_at

### source_adapters

Stores source config and status.

Fields:

- id
- source_key
- display_name
- enabled
- mode: api/manual/csv/feed
- credential_status
- last_success_at
- last_error_at
- last_error_message
- settings_json
- created_at
- updated_at

### product_candidates

Stores discovered candidates before approval.

Fields:

- id
- source_key
- source_product_id
- raw_payload_json
- normalized_json
- title
- brand
- model
- price_amount
- price_currency
- price_fetched_at
- product_url
- affiliate_url
- image_url
- confidence_score
- fit_tags
- risk_tags
- compliance_status
- review_status: pending/approved/rejected/needs_edit/stale
- admin_notes
- created_at
- updated_at

### approved_products

Use existing product table if present. Otherwise create approved product records.

Fields:

- id
- product_candidate_id
- normalized specs
- source fields
- approved_by
- approved_at
- public_status
- created_at
- updated_at

### blog_topic_queue

Fields:

- id
- topic
- intent
- source_signal
- priority_score
- status
- created_at
- updated_at

### blog_drafts

Fields:

- id
- topic_id
- title
- slug
- outline_json
- content_markdown
- seo_json
- internal_links_json
- product_suggestions_json
- quality_score
- fact_check_json
- status: draft/review/approved/scheduled/published/rejected
- scheduled_at
- published_at
- created_at
- updated_at

### chip_interaction_events

Fields:

- id
- user_id nullable
- anonymous_session_id nullable
- event_type
- input_summary
- extracted_intent_json
- product_id nullable
- source_key nullable
- metadata_json
- created_at

### chip_user_profiles / chip_session_profiles

Fields:

- id
- user_id or session_id
- preference_summary_json
- budget_range_json
- course_tags
- software_tags
- brand_preferences
- last_updated_at

### affiliate_click_events

Fields:

- id
- source_key
- product_id nullable
- placement
- page_url
- user_id nullable
- session_id nullable
- affiliate_url_hash
- clicked_at

## Data retention

Add retention settings for:

- Raw product payloads
- User interaction events
- Anonymous session profiles
- Job logs
- Affiliate click logs

## Acceptance criteria

- Migrations follow existing project style.
- No secrets are stored in public-readable tables.
- Data can be deleted/cleaned safely.
- Logs are useful for debugging but not privacy-invasive.

## Blog author personas

Add a first-class persona/author model if the platform does not already have one.

Suggested tables/collections:

### `blog_author_personas`

Fields:

- id
- slug
- display_name
- public_role
- short_bio
- long_internal_description
- author_type: human | ai_persona | brand
- status: draft | active | disabled | archived | soft_deleted
- version
- avatar_url
- expertise_tags
- target_audience_tags
- topic_category_tags
- software_workflow_tags
- tone_settings_json
- buying_philosophy
- writing_dos_json
- writing_donts_json
- persona_system_prompt
- affiliate_policy_json
- permissions_json
- priority_weight
- is_default_fallback
- created_at
- updated_at
- archived_at

### `blog_persona_versions`

Store snapshots of persona versions used for published posts.

Fields:

- id
- persona_id
- version
- snapshot_json
- created_at

### Blog draft/post fields

Add to existing blog draft/post model:

- author_persona_id
- author_persona_version
- author_persona_snapshot_json
- author_type
- persona_selection_reason
- persona_generated: boolean
- research_input_ids

### Audit events

Add event types:

- persona.created
- persona.updated
- persona.disabled
- persona.archived
- persona.soft_deleted
- persona.hard_deleted
- persona.restored
- persona.assigned_to_draft
- persona.assigned_to_post
- persona.reassigned
- persona.preview_generated

Published posts must keep author attribution even if the persona is later edited or archived.


## Additional schema: research editorial calendar

Add persistent tables/models for:

### `research_editorial_calendar`

Stores calendar name, enabled state, timezone, global mode, max posts per day/week, and ownership metadata.

### `research_calendar_day`

Stores day-wise configuration: day, enabled state, run time, theme, keywords, target audience, content types, source priority, preferred personas, post target, approval mode, affiliate insertion mode, quality thresholds, expiry hours.

### `research_schedule_run`

Stores every scheduled/manual run: calendar day, run trigger, start/end timestamps, status, error message, packets produced, drafts produced, source failures, and admin notification state.

### `research_packet`

Stores the structured handoff from Research Agent to Blog Writer/Persona Author Agent. Include theme, target audience, suggested personas, findings, product candidate references, source references, confidence score, content type, monetization intent, expiry, and status.

See `schemas/research_editorial_calendar.schema.json`.
