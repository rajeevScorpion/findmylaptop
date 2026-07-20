# FindMyLaptop

## Administrator documentation

- Use the mobile-friendly in-app guide at **Admin → Admin Guide** (`/admin/guide`).
- Read [`docs/ADMIN_OPERATIONS_GUIDE.md`](docs/ADMIN_OPERATIONS_GUIDE.md) for the complete operational and power-user handbook.
- Read [`docs/AUTONOMOUS_AGENTS_RUNBOOK.md`](docs/AUTONOMOUS_AGENTS_RUNBOOK.md) for staging activation, environment, migration, retention, and rollback procedures.

A mobile-first, single-page laptop recommendation website for design students. Helps students find the right laptop based on their course, budget, and creative workflow — with Amazon affiliate links and an admin utility for managing recommendations.

## Features

- **Public recommender**: Guided finder (course → budget → workload) → matching laptop cards
- **Instant filtering**: All filtering runs client-side after a single SSR data load
- **Laptop comparison**: Compare up to 3 laptops side-by-side
- **Educational sections**: Hardware explainer, AI disruption in design, MacBook/iPad guidance
- **WhatsApp CTA**: Configurable group link for student doubts
- **Admin utility**: Supabase Auth + email allowlist → add laptops by pasting Amazon details → OpenAI extracts specs → review → publish

---

## Tech Stack

- **Next.js 16** App Router, TypeScript
- **Tailwind CSS v4** + shadcn/ui (base-nova style with @base-ui/react)
- **Framer Motion** (LazyMotion for reduced bundle)
- **Supabase** (Postgres + Auth)
- **OpenAI Responses API** with task-specific model routing and Structured Outputs
- **Zod** + React Hook Form

---

## Local Setup

```bash
# 1. Enter the project
cd findmylaptop

# 2. Install dependencies
npm install

# 3. Copy env file and fill in values
cp .env.example .env.local
# Edit .env.local — see Environment Variables below

# 4. Run migrations in Supabase (see Supabase Setup below)

# 5. Start dev server
npm run dev
```

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=sk-your_openai_key
ADMIN_EMAILS=your-email@example.com
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> **Important**: Do not put spaces before the value in `.env.local`. Use `KEY=value` not `KEY= value`.

- `NEXT_PUBLIC_*` keys are safe to expose to the browser
- `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are server-only — never expose in client code
- `ADMIN_EMAILS` is a comma-separated list of emails that can access `/admin`

---

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Get your **Project URL**, **anon key**, and **service role key** from **Project Settings → API**
3. Open the **SQL Editor** in your Supabase dashboard
4. Run these migration files **in order**:

```
supabase/migrations/001_create_courses.sql
supabase/migrations/002_create_laptops.sql
supabase/migrations/003_create_settings.sql
supabase/migrations/004_seed_courses.sql
supabase/migrations/005_rls_policies.sql
... (006–016 — chat, feedback, blog, voice flag, etc.)
supabase/migrations/017_add_laptop_domain.sql       # multi-domain: laptop.domain
supabase/migrations/018_courses_taxonomy.sql        # courses → admin-managed taxonomy
supabase/migrations/019_seed_domain_taxonomies.sql  # seed tech/management programmes
supabase/migrations/020_seed_domain_flags.sql       # domain_tech/mgmt_enabled flags
... (021–023 — existing product/blog support)
supabase/migrations/024_create_agent_foundations.sql
... (025–032 — product research, calendar, personas, Chip learning,
    blog agent, affiliate events, and access hardening)
```

Copy the contents of each file and paste into the SQL editor, then click **Run**.
Each migration `0NN_*.sql` has a matching `0NN_*_rollback.sql` to undo it (run
in reverse order if needed).

> **Multi-domain (Design / Technology / Management):** migrations 017–020 add the
> domain dimension. Technology and Management ship **disabled** — turn each on in
> **Admin → Settings → Domains** once its laptops and programmes are ready.
> Manage each domain's programmes in **Admin → Taxonomy**.

---

## Creating an Admin Account

1. In your Supabase dashboard, go to **Authentication → Users**
2. Click **Add user** → **Create new user**
3. Enter the email and password for your admin account
4. Add that email to `ADMIN_EMAILS` in your `.env.local`

Only users whose email is listed in `ADMIN_EMAILS` can access the admin panel, even if they have valid Supabase Auth sessions.

---

## Adding Laptop Recommendations (Admin)

1. Go to `http://localhost:3000/admin/login`
2. Sign in with your Supabase Auth credentials
3. Click **Add Laptop**
4. In the **Process with AI** section, paste raw Amazon product details (title, bullet points, specs table)
5. Click **Extract specs with AI** — OpenAI will populate the form fields
6. Review and edit all fields (especially cautions and why_recommended)
7. Select **Workload Tags** and **Recommended Courses**
8. Set the **Amazon Affiliate URL**
9. Toggle **Published** to make it visible on the public site
10. Click **Create Laptop**

---

## How OpenAI Processing Works

The `/api/admin/process-laptop` route:
1. Verifies the caller is an authenticated admin (session + ADMIN_EMAILS check)
2. Sends the pasted text to the configured extraction model (default:
   `gpt-5.6-luna`) using the Responses API and Structured Outputs
3. Returns a JSON object with laptop specs, workload tags, recommended courses, why_recommended, cautions, and 4-year suitability
4. The admin reviews and edits before saving — nothing is auto-saved

The OpenAI API key is only used server-side and never exposed to the browser.

---

## Updating Amazon Affiliate Links

Edit any laptop's affiliate URL from `/admin/laptops/[id]` → **Amazon Affiliate URL** field → Save.

---

## Updating the WhatsApp Group Link

1. Go to `/admin/settings`
2. Update the **WhatsApp Group / Chat URL**
3. Click **Save Settings**

---

## Deploying on Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Link project
vercel link

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add OPENAI_API_KEY
vercel env add ADMIN_EMAILS
vercel env add NEXT_PUBLIC_SITE_URL  # set to your Vercel domain

# Deploy
vercel deploy --prod
```

Or connect the GitHub repo to Vercel via the dashboard and add env vars in **Project Settings → Environment Variables**.

---

## Why Not Local SQLite?

Vercel serverless functions do not provide a reliable persistent writable filesystem. A SQLite database written during one function invocation is not accessible to others. Supabase provides a hosted Postgres database that works correctly with Vercel's ephemeral serverless environment.

---

## Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. It is only used in server-side code (`src/lib/supabase/admin.ts`, API routes). It must never appear in client-side bundles.
- `OPENAI_API_KEY` is used only by server-side extraction, research, writing, persona-preview, Chip, and transcription services.
- The admin email check is done **both** in `src/app/admin/layout.tsx` (UI protection) **and** in the API route (defense in depth).
- RLS policies ensure anonymous users can only read published laptops. See `supabase/migrations/005_rls_policies.sql` and the access hardening in `supabase/migrations/032_harden_catalog_and_taxonomy_access.sql`.

---

## Row Level Security Policies

| Table | anon | authenticated |
|---|---|---|
| `courses` | SELECT | SELECT |
| `laptops` | SELECT (is\_published=true only) | SELECT |
| `settings` | SELECT | SELECT |

Admin writes use authenticated, allowlisted server APIs and the service-role client, which bypasses RLS. This is intentional only while the key remains server-side and every mutation keeps its authorization and validation checks.
