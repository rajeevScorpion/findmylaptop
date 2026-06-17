# 01 — Codebase Discovery and Safety Requirements

## Objective

Before coding, discover how LaptopFinder.cc is actually built. This pack suggests likely patterns, but the codebase is the source of truth.

## Required discovery checklist

Run and document findings for:

```bash
pwd
git status
ls
find . -maxdepth 2 -type f | sed 's#^\./##' | sort | head -200
```

Then inspect:

- Package manager: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`
- Framework: Next.js, Vite, Remix, Express, etc.
- Routing: App Router, Pages Router, API routes, route handlers, server actions
- Database: Supabase, Prisma, Drizzle, raw SQL, Firebase, another service
- Auth: Supabase auth, NextAuth/Auth.js, custom admin auth, Clerk, Firebase, etc.
- Admin area: existing `/admin`, dashboard routes, protected layouts, middleware
- UI: Tailwind, shadcn/ui, custom components, MUI, Chakra, CSS modules
- Icons: Lucide, Heroicons, Font Awesome, existing icon package
- Data fetching: server components, API handlers, tRPC, TanStack Query
- Existing SEO: metadata helpers, sitemap, robots, schema helpers
- Product data model: laptops/products/specs/affiliate links/categories
- Deployment: Vercel, environment variables, build scripts
- Tests: Jest, Vitest, Playwright, Cypress, React Testing Library

## Files to look for

```text
app/
pages/
src/
components/
lib/
utils/
db/
prisma/
supabase/
migrations/
middleware.ts
next.config.js
next.config.mjs
tailwind.config.*
package.json
.env.example
```

## Safety instructions

Do not assume:

- that the app uses Next.js App Router
- that the database is Prisma
- that admin auth already exists
- that product cards already exist
- that blog pages do not already exist
- that AI/OpenAI is not already integrated
- that the same OpenAI model/API used elsewhere should be reused without checking
- that environment variables are named in a particular way

## First required output before changes

Create a short internal implementation note, either in your work log or PR notes:

```md
## Codebase discovery summary

- Framework:
- Routing:
- DB:
- Auth:
- Admin:
- UI:
- Existing product data model:
- Existing SEO handling:
- Existing OpenAI integration:
- Existing feature flag pattern:
- Risk areas:
- Questions/clarifications:
```

## If something is unclear

Ask. Do not guess.

Examples:

- "I found no admin auth. Should I add a basic admin guard or integrate with existing auth provider?"
- "The app has products but no normalized specs table. Should product cards reference existing laptop IDs only?"
- "There is an existing blog route. Should I extend it or replace it?"
- "There is no database migration system. Should I add one or use the existing Supabase SQL workflow?"
