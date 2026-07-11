# Stella Force — Project Context (source of truth)

AI-native recruiting platform for recruiters. This file is the **frozen source of
truth** for schema, vocabularies, workflows, and conventions. Keep it in sync with
`supabase/migrations/` and `src/lib/supabase/types.ts` — if they disagree, this
file wins and the others must be corrected.

## Stack
- **Next.js (App Router) + TypeScript**, `src/` dir, `@/*` alias
- **Tailwind CSS v4 + shadcn/ui** (base-nova style, built on `@base-ui/react`)
- **TanStack Table** for data grids
- **Supabase** (Postgres + pgvector) — Auth + Row-Level Security
- **Claude API** (`@anthropic-ai/sdk`) for AI parsing — server-side only
- Deploy target: **Vercel**

## Stack conventions (follow these)
- **Reads → Server Components** via helpers in `src/lib/data.ts` (request-scoped
  anon client, RLS applies).
- **Writes → Server Actions** (`src/app/**/actions.ts`) use the request-scoped
  server client (`src/lib/supabase/server.ts`) so they run as the signed-in
  user's session and respect RLS. The service-role admin client
  (`src/lib/supabase/admin.ts`) is reserved for privileged operations with no
  acting user (seeding, backfills) — not regular CRUD writes.
- **Service-role key + `ANTHROPIC_API_KEY` are server-only.** Guarded by
  `import "server-only"` in `admin.ts`, `ai/*`, `env.ts`(serverEnv), `data.ts`,
  `auth.ts`.
- **PII never sent to the client** beyond what a Server Component renders. Never
  expose the service-role key or raw Claude keys to the browser.
- Supabase clients: `client.ts` (browser, anon), `server.ts` (server, anon +
  cookies → RLS), `admin.ts` (server, service-role → bypasses RLS).

## Embeddings (IMPORTANT)
- `candidates.embedding_vector` is **vector(1536)**.
- **Anthropic has no embeddings endpoint.** Claude is used for parsing only.
  `src/lib/ai/embeddings.ts` currently returns a **deterministic placeholder**
  1536-dim vector so write paths work end-to-end. **Wire a real provider**
  (OpenAI `text-embedding-3-small` = 1536 dims, or Voyage AI per Anthropic's
  recommendation) before semantic search is meaningful. If you switch to a
  provider with a different dimension, update both `EMBEDDING_DIM`
  (`src/lib/constants.ts`) and the `vector(N)` column + ivfflat index.

---

## Frozen schema

UUID PKs via `gen_random_uuid()`. Every table has `created_at`/`updated_at`
(trigger-managed); some tables carry additional domain timestamps. All enums are
Postgres enum types. snake_case throughout.

### Enums (controlled vocabularies)
- `candidate_tier`: **gold | silver | bronze**
- `data_provenance`: **ai_parsed | recruiter_confirmed | enriched**
- `skill_type`: **hard | soft**
- `proficiency_level`: **novice | beginner | intermediate | advanced | expert** (novice=1 … expert=5)
- `client_status`: **active | paused | churned**
- `job_status`: **open | on_hold | filled | closed**
- `application_stage` (pipeline): **sourced | screened | submitted | interviewing | offer | placed | rejected**
- `placement_status`: **active | completed | fell_through**
- `interaction_type`: **call | email | interview | note**
- `nurture_status`: **active | dormant | re_engaging**
- `user_role`: **recruiter | manager | admin**

### Tables

**candidates** (core)
`candidate_id` (uuid pk), `full_name` (not null), `contact_info` (jsonb: email/phone/location/tz),
`linkedin_url`, `portfolio_url`, `current_title`, `current_company`, `years_experience` (int),
`education` (jsonb), `certifications` (jsonb), `languages` (text[]),
`professional_summary` (text), `source` (text),
`candidate_tier` (enum), `tier_rationale` (text),
`embedding_vector` (vector(1536)), `data_provenance` (enum, default ai_parsed),
`freshness_score` (numeric), `last_verified` (timestamptz),
`date_added`, `last_updated`, `created_at`, `updated_at`.
_redeployment_fit lives in the `candidate_client_fit` join table (below)._

**skills**
`skill_id` (uuid pk), `candidate_id` (fk), `skill_name` (text, controlled taxonomy),
`skill_type` (enum), `proficiency_level` (enum), `assessment_score` (numeric),
`scorecard` (jsonb), `ai_literacy_signal` (jsonb: tool_used/how_used/measurable_outcome).

**clients**
`client_id` (uuid pk), `client_name` (not null), `status` (enum), `notes` (text).

**job_orders**
`job_id` (uuid pk), `client_id` (fk), `title`, `description`, `required_skills` (text[]),
`salary_range` (jsonb: min/max/currency/period), `status` (enum).

**applications** (pipeline)
`application_id` (uuid pk), `candidate_id` (fk), `job_id` (fk), `client_id` (fk),
`stage` (enum), `status_reason` (text), `human_review_flag` (bool, default false),
`date_applied`, `date_updated`. Unique(candidate_id, job_id).

**placements**
`placement_id` (uuid pk), `candidate_id` (fk), `client_id` (fk), `job_id` (fk),
`role_placed`, `salary` (numeric), `placement_date` (date), `guarantee_period` (text),
`status` (enum).

**interactions** (CRM log)
`interaction_id` (uuid pk), `candidate_id` (fk), `type` (enum), `body` (text),
`interaction_at` (timestamptz), `communication_preferences` (jsonb), `consent` (bool),
`relationship_strength` (numeric), `nurture_status` (enum).

**candidate_client_fit** (join table — powers redeployment_fit)
`id` (uuid pk), `candidate_id` (fk), `client_id` (fk), `fit_score` (numeric),
`rationale` (text). Unique(candidate_id, client_id). Decouples a candidate from a
single role so one candidate can be scored against many clients → redeployment.

**profiles** (auth — one row per `auth.users` row, auto-created by trigger)
`id` (uuid pk, fk → `auth.users.id`), `email` (not null), `full_name`,
`role` (enum, default `recruiter`), `created_at`, `updated_at`. No public
sign-up: users are created manually in the Supabase dashboard (Auth → Users,
Auto Confirm on); `handle_new_user()` inserts the matching profile row;
`role` is hand-promoted afterward via SQL. Role is stored but **not yet
enforced** — every authenticated user has full CRUD via the existing
permissive RLS policies. Role-based restriction is a future pass.

### Indexes
FK indexes on every fk column; filter indexes on `candidates.candidate_tier`,
`applications.stage`, `job_orders.status`; **ivfflat** on
`candidates.embedding_vector` (`vector_cosine_ops`, lists=100).

### Skill taxonomy note
`skills.skill_name` should come from a controlled taxonomy. Starter list lives in
`SKILL_TAXONOMY` (`src/lib/constants.ts`). In production this becomes a managed
table; for now it seeds filters and steers AI parsing.

---

## Workflow specs

1. **Feed-in / ADD CANDIDATE (manual)** — a form → Server Action `addCandidate`
   writes a `candidates` row with `data_provenance = recruiter_confirmed`, sets
   `date_added`/`last_updated`/`freshness_score`, generates `embedding_vector`.
   _Implemented: `src/app/candidates/actions.ts`, `/candidates/new` (Manual tab)._

2. **INGESTION (AI + human confirm)** — `/candidates/new` (AI tab): paste raw text
   → Server Action `parseCandidate` calls Claude (`src/lib/ai/parse.ts`, structured
   outputs) → returns a pre-filled **editable** draft (`data_provenance = ai_parsed`)
   → recruiter edits/confirms → `createCandidateFromParsed` writes candidate +
   skills, **flips provenance to `recruiter_confirmed`**, generates embedding.
   _Implemented._

3. **ADD-TO-ORDER / REFER & UPDATE** — attach a candidate to a `job_order` as an
   `application`; advance `stage`; log `interactions`; maintain `candidate_client_fit`
   for redeployment. _TODO stub — see `/candidates/[id]` and `/job-orders/[id]`._

4. **SEARCH** — two modes: **structured filters** (tier/skill/location, implemented
   on `/candidates` and `/search` → Filters) and **semantic** (embedding similarity,
   **TODO stub** on `/search` → Semantic; needs a real embeddings provider + a
   pgvector similarity RPC over the ivfflat index).

---

## Routes
- `/candidates` — TanStack Table list + structured filters
- `/candidates/[id]` — profile view
- `/candidates/new` — ingestion flow (manual + AI)
- `/job-orders` — list
- `/job-orders/[id]` — detail with attached candidates (applications)
- `/search` — Filters (structured) + Semantic (stub) tabs

## Build order
1. **CRUD spine + structured search** ✅ (this scaffold)
2. **AI ingestion** ✅ (parse → confirm → write)
3. **Semantic search** — wire embeddings provider + pgvector RPC (TODO)
4. **Refer/update loop** — applications, interactions, candidate_client_fit (TODO)

## Migrations
SQL lives in `supabase/migrations/` (0001 extensions+enums → 0002 tables →
0003 indexes → 0004 RLS → 0005 auth roles). Apply via the Supabase CLI
(`supabase db push`) or the SQL editor. RLS is minimal: authenticated users
read/write all core tables; anonymous users get nothing (PII not public); the
service-role key bypasses RLS for privileged operations (seeding, backfills).

## Auth
Supabase Auth, email/password only, no public sign-up — recruiters/managers/
admins are created manually in the dashboard. `src/middleware.ts` +
`src/lib/supabase/middleware.ts` refresh the session and redirect signed-out
requests to `/login`. `src/lib/auth.ts` (`getCurrentProfile`) resolves the
signed-in user's `profiles` row server-side; `src/app/login/` holds the login
page and the `login`/`logout` Server Actions. See the **profiles** table above
for role provisioning.
