# Persona Management Tool — Define, Create, Edit, Remove

## Purpose

Create an admin tool for managing blog author personas used by the Persona-Based Blog Author Agent.

Personas must be first-class records, not hardcoded prompts. Admin should be able to define, create, edit, disable, archive, and remove personas without code changes.

## Required admin capabilities

### 1. Define persona blueprint

Admin can define the structure/rules for a persona before creating it.

Fields:

- Persona type: human, AI/editorial persona, brand persona
- Display name
- Slug
- Public role/title
- Short public bio
- Long internal description
- Avatar/icon
- Expertise tags
- Target audience tags
- Topic categories
- Software/workflow tags
- Tone settings
- Writing dos and don’ts
- Buying philosophy
- Affiliate rules
- Disclosure text
- Persona system prompt
- Example intros/outros
- Status: draft, active, disabled, archived

### 2. Create persona

Admin can create a persona from scratch or from templates.

Suggested default templates:

- Senior Design Professor / Fashion Design Software Mentor
- Native App Developer / Coding Laptop Specialist
- Parent-Friendly Laptop Buying Advisor
- Budget-Conscious Student Mentor
- AI/ML Workstation Advisor
- Video Editing and Animation Mentor
- Laptop Service and Reliability Expert
- LaptopFinder Editorial Guide

Creation flow:

1. Choose template or blank persona.
2. Fill public author profile.
3. Fill internal writing behavior.
4. Add expertise/topic tags.
5. Add disclosure type.
6. Preview author card.
7. Generate sample paragraph.
8. Save as draft or activate.

### 3. Edit persona

Admin can edit persona details.

Important: published articles must preserve the persona version used at the time of publishing. Editing a persona should increment `version` and should not rewrite past public attribution unless admin intentionally applies an update.

Editable fields:

- Public display name
- Role/title
- Bio
- Avatar
- Expertise tags
- Topic tags
- Tone settings
- Persona prompt
- Disclosure text
- Active/disabled status
- Priority weight
- Default/fallback persona flag

### 4. Remove persona

Do not hard-delete personas that have published posts by default.

Use this removal model:

- **Disable**: persona cannot be used for new drafts but remains public on old posts.
- **Archive**: persona removed from selection lists but author archive still works for old posts.
- **Soft delete**: hidden from admin lists by default, recoverable by super-admin.
- **Hard delete**: allowed only if persona has no published posts, no scheduled posts, and no drafts, or after reassignment.

Admin must be warned before removing a persona that has content dependencies.

### 5. Reassign posts

Admin can reassign drafts or unpublished posts from one persona to another.

For published posts, reassignment should require explicit confirmation and should keep an audit log.

### 6. Preview persona

Admin can test a persona before activation:

- Generate a sample intro for a topic.
- Generate a buying advice paragraph.
- Generate an author card preview.
- Compare same topic across multiple personas.

### 7. Persona permissions

Each persona can have permissions:

- Can write blogs
- Can write product comparisons
- Can include product cards
- Can mention affiliate links
- Requires manual review always
- Can be used by auto-scheduler
- Can be used only for drafts, not direct publishing

## Suggested API/service layer

```ts
type PersonaStatus = 'draft' | 'active' | 'disabled' | 'archived' | 'soft_deleted';
type AuthorType = 'human' | 'ai_persona' | 'brand';

type Persona = {
  id: string;
  slug: string;
  displayName: string;
  publicRole: string;
  shortBio: string;
  longInternalDescription?: string;
  authorType: AuthorType;
  status: PersonaStatus;
  version: number;
  avatarUrl?: string;
  expertiseTags: string[];
  targetAudienceTags: string[];
  topicCategoryTags: string[];
  softwareWorkflowTags: string[];
  toneSettings: {
    formality: 'friendly' | 'professional' | 'academic' | 'technical';
    depth: 'basic' | 'intermediate' | 'advanced';
    reassuranceLevel: 'low' | 'medium' | 'high';
    technicalDensity: 'low' | 'medium' | 'high';
  };
  buyingPhilosophy: string;
  writingDos: string[];
  writingDonts: string[];
  personaSystemPrompt: string;
  affiliatePolicy: {
    allowAffiliateLinks: boolean;
    maxProductCards: number;
    requiredDisclosureText: string;
  };
  permissions: {
    canWriteBlogs: boolean;
    canWriteComparisons: boolean;
    canInsertProductCards: boolean;
    canBeAutoScheduled: boolean;
    alwaysRequiresManualReview: boolean;
  };
  priorityWeight: number;
  isDefaultFallback: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}
```

Suggested service methods:

```ts
createPersona(input)
updatePersona(personaId, patch)
disablePersona(personaId)
archivePersona(personaId)
softDeletePersona(personaId)
hardDeletePersona(personaId)
restorePersona(personaId)
listPersonas(filters)
getPersonaById(personaId)
getPersonaBySlug(slug)
previewPersona(personaId, topicInput)
selectPersonaForTopic(topicInput)
reassignDraftPersona(draftId, personaId)
reassignPublishedPostPersona(postId, personaId, confirmation)
```

## UI pages

Required admin pages:

- `/admin/personas` — list/search/filter personas
- `/admin/personas/new` — create persona
- `/admin/personas/{id}` — view/edit persona
- `/admin/personas/{id}/preview` — test output
- `/admin/personas/templates` — manage templates if needed

Required fields in persona list:

- Name
- Role
- Type
- Status
- Tags
- Posts count
- Drafts count
- Last used
- Version
- Actions: edit, preview, disable, archive, remove

## Audit logging

Log every persona management event:

- persona.created
- persona.updated
- persona.enabled
- persona.disabled
- persona.archived
- persona.soft_deleted
- persona.hard_deleted
- persona.restored
- persona.assigned_to_draft
- persona.assigned_to_post
- persona.reassigned
- persona.preview_generated

## Acceptance criteria

- Admin can create a persona without code changes.
- Admin can edit persona prompts and public author details.
- Admin can disable/archive/remove personas safely.
- Persona deletion does not break old blog author pages.
- Persona-written blogs display author cards publicly.
- Persona selection can be automatic or manually overridden.
- All persona changes are logged.
