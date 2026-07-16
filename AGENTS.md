<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Development and release workflow

- Develop on the `preview` branch using the staging Supabase project.
- Push changes to `preview` and test them at `dev.laptopfinder.cc`.
- Promote confirmed changes from `preview` to `master` only after explicit user approval.
- Do not push to `master` or apply production database changes without explicit user confirmation.

## Database migrations

- Every database schema change must include both a forward migration and a paired rollback migration.
- The user runs migrations and rollbacks manually; do not apply them to staging or production unless explicitly requested.
- Provide migrations in the exact order in which they should be run.
