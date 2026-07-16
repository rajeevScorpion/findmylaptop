# Phase 03A Prompt — Persona-Based Blog Author Agent and Persona Management

Implement persona-based blog authoring as an extension to the existing blog workflow.

Before writing code, investigate the existing blog/CMS data model, author model, route structure, admin panel, draft workflow, and publishing system. Do not assume there is already an author table. Do not break existing published blog pages.

Required outcome:

1. Add a Persona Management Tool in admin.
2. Treat personas as first-class blog authors.
3. Allow admin to define/create/edit/disable/archive/remove personas.
4. Add persona selection for blog drafts using research/topic inputs.
5. Store `authorPersonaId` and persona version/snapshot with drafts/posts.
6. Display persona author cards publicly on blog posts.
7. Add public author archive pages if compatible with current routing.
8. Ensure fictional personas are disclosed as LaptopFinder editorial/expert personas.

Implementation constraints:

- Existing blog posts must continue to work.
- Do not hard-delete personas that have published posts by default.
- Existing human authors, if any, must not be overwritten.
- All persona management changes must be audit logged.
- Admin must be able to manually override the persona selected by automation.
- Auto-publishing must respect persona permissions and global publishing settings.

Recommended commit sequence:

1. Inspect existing blog author/data model.
2. Add persona schema/table/migration.
3. Add persona CRUD service with safe delete/archive behavior.
4. Add admin persona management UI.
5. Add persona selector service.
6. Integrate with blog draft generation.
7. Add public author display + archive route.
8. Add tests and QA fixtures.

Acceptance tests:

- Create an active AI/editorial persona from admin.
- Generate a blog draft using that persona.
- Change the persona before publishing.
- Publish and verify author card is visible.
- Disable persona and verify it cannot be selected for new drafts.
- Verify old posts still show the correct persona snapshot.
- Attempt hard delete of a persona with published posts and verify it is blocked.
