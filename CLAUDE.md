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
- `user_role`: **recruiter | manager | admin** (Stellaforce-side only)
- `profile_side`: **stellaforce | client** — which side of the platform a profile belongs to
- `client_role`: **member | admin** (client-side only, mirrors `user_role`'s purpose for the client side)

### Tables

**candidates** (core)
`candidate_id` (uuid pk), `full_name` (not null), `contact_info` (jsonb: email/phone/location/tz),
`linkedin_url`, `portfolio_url`, `current_title`, `current_company`, `years_experience` (int),
`education` (jsonb), `certifications` (jsonb), `languages` (text[]),
`professional_summary` (text), `source` (text),
`candidate_tier` (enum), `tier_rationale` (text),
`embedding_vector` (vector(1536)), `data_provenance` (enum, default ai_parsed),
`freshness_score` (numeric), `last_verified` (timestamptz),
`added_by` (uuid, fk → `profiles.id`, nullable — which recruiter/manager/admin
added this candidate; app write paths should always set it),
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
`role` (enum, default `recruiter` — Stellaforce-side only), `side` (enum,
default `stellaforce`), `client_id` (fk → `clients.client_id`, nullable —
set for client-side profiles only), `client_role` (enum, nullable — set for
client-side profiles only), `created_at`, `updated_at`. A check constraint
enforces `side = 'stellaforce'` ⟺ `client_id`/`client_role` are null, and
`side = 'client'` ⟺ both are set. No public sign-up: users are created
manually in the Supabase dashboard (Auth → Users, Auto Confirm on);
`handle_new_user()` inserts the matching profile row defaulted to the
Stellaforce side; `role` (Stellaforce-side) or `side`/`client_id`/
`client_role` (client-side, when onboarding a new client) are hand-set
afterward via SQL. All of this is stored but **not yet enforced** — every
authenticated user, Stellaforce or client-side, has full CRUD via the
existing permissive RLS policies. Role-based and client-scoped restriction
is a future pass.

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
   for redeployment. _TODO stub — see `/candidates/[id]` and `/jobs/[id]`._

4. **SEARCH** — two modes: **structured filters** (tier/skill/location, implemented
   on `/candidates` and `/search` → Filters) and **semantic** (embedding similarity,
   **TODO stub** on `/search` → Semantic; needs a real embeddings provider + a
   pgvector similarity RPC over the ivfflat index).

---

## Routes
- `/home` — dashboard: candidate/job/client counts, links into each list
- `/candidates` — TanStack Table list + structured filters
- `/candidates/[id]` — profile view
- `/candidates/new` — ingestion flow (manual + AI)
- `/jobs` — list (was `/job-orders`)
- `/jobs/[id]` — detail with attached candidates (applications)
- `/clients` — list
- `/settings` — signed-in user's email/role
- `/search` — Filters (structured) + Semantic (stub) tabs (not in main nav)
- `/login` — email/password sign-in

## App shell
Left sidebar (`src/components/app-sidebar.tsx`) + top header
(`src/components/app-header.tsx`), both driven by the shared nav config in
`src/lib/nav.ts` (`NAV_ITEMS`, `SETTINGS_ITEM`). Icons are **lucide-react**
(project default icon library). Root layout: `src/app/layout.tsx`.

## Build order
1. **CRUD spine + structured search** ✅ (this scaffold)
2. **AI ingestion** ✅ (parse → confirm → write)
3. **Semantic search** — wire embeddings provider + pgvector RPC (TODO)
4. **Refer/update loop** — applications, interactions, candidate_client_fit (TODO)

## Migrations
SQL lives in `supabase/migrations/` (0001 extensions+enums → 0002 tables →
0003 indexes → 0004 RLS → 0005 auth roles → 0006 candidates.added_by →
0007 client profiles). Apply
via the Supabase CLI
(`supabase db push`) or the SQL editor. RLS is minimal: authenticated users
read/write all core tables; anonymous users get nothing (PII not public); the
service-role key bypasses RLS for privileged operations (seeding, backfills).

## Auth
Supabase Auth, email/password only, no public sign-up — Stellaforce-side
recruiters/managers/admins and client-side members/admins are all created
manually in the dashboard. `src/proxy.ts` (Next.js 16's `middleware.ts`
convention) + `src/lib/supabase/middleware.ts` refresh the session and
redirect signed-out requests to `/login`. `src/lib/auth.ts`
(`getCurrentProfile`) resolves the signed-in user's `profiles` row
server-side; `src/app/login/` holds the login page and the `login`/`logout`
Server Actions. See the **profiles** table above for role provisioning
(Stellaforce-side) and client onboarding (client-side).
