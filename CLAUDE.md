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

## Frozen schema (V3.2)

UUID PKs via `gen_random_uuid()`. Every table has `created_at` (and
`updated_at` where rows mutate post-insert). All enums are Postgres enum
types. snake_case throughout. V3.2 is a substantial normalization over the
original scaffold: candidates gained real work-history/education/cert/link
child tables, skills/tools became global lookups, and jobs gained a full
evaluation-criteria → scorecard → workflow model with a two-tier pipeline
(fixed Tier-1 stages + variable per-job Tier-2 sub-stages).

### Enums (controlled vocabularies)
- `candidate_tier`: **gold | silver | bronze**
- `data_provenance`: **ai_parsed | recruiter_confirmed | enriched**
- `skill_type`: **technical | functional | behavioral** (was hard|soft)
- `proficiency_level`: **beginner | intermediate | advanced | expert** (candidate_skills/candidate_tools; was novice..expert)
- `fit_proficiency_level`: **aware | proficient | expert** (job_competencies.recommended_level, achieved_proficiency — a distinct scale from proficiency_level)
- `confidence_level`: **low | medium | high** (scorecard + fit confidence fields)
- `client_status`: **active | paused | churned**
- `job_status`: **draft | open | paused | filled | closed** (was open|on_hold|filled|closed)
- `competency_type`: **technical | behavioral | hybrid | leadership**
- `pipeline_stage`: **source | screen | interview | offer | close** (fixed Tier-1 canonical stages, never vary — used for cross-job audit/rollup)
- `stage_format`: **phone | video | onsite | async**
- `rating_scale`: **star | ten-point | hundred-point**
- `employment_type`: **full-time | part-time | contract | freelance | internship**
- `workplace_type`: **on-site | hybrid | remote**
- `application_status`: **active | hired | rejected | withdrawn | on_hold** (replaces the old `application_stage` enum — stage progression now lives in `applications.current_stage_id`)
- `eval_status`: **pending | completed**
- `placement_status`: **active | completed | fell_through**
- `interaction_type`: **call | email | interview | note**
- `nurture_status`: **active | dormant | re_engaging**
- `user_role`: **recruiter | manager | admin** (Stellaforce-side only)
- `profile_side`: **stellaforce | client** — which side of the platform a profile belongs to
- `client_role`: **member | admin | reviewer | recruiter** (client-side only)
- `url` (domain, not enum): `text` CHECK `value ~* '^https?://.+'` — applied to newly-added URL columns only (existing `candidates.linkedin_url`/`portfolio_url` remain plain `text`)

### Candidate domain

**candidates** (core)
`candidate_id` (uuid pk), `first_name`/`last_name` (not null), `full_name`
(generated: `first_name || ' ' || last_name`), `headline`, `current_title`,
`current_company`, `professional_summary`, `email` (unique), `phone`,
`location_city`/`location_state`/`location_country`/`location_raw`,
`timezone` (IANA, decoupled from location), `is_open_to_remote`,
`is_open_to_relocation`, `languages` (text[]), `years_experience` (int, cached
aggregate), `linkedin_url`, `portfolio_url`, `github_url`, `resume_path`,
`avatar_url`, `source` (text), `source_metadata` (jsonb),
`candidate_tier` (enum), `tier_rationale` (text),
`data_provenance` (enum, default ai_parsed), `data_confidence_score`,
`data_confidence_breakdown` (jsonb), `freshness_score`, `last_verified`,
`last_scored_at`, `embedding_vector` (vector(1536)),
`added_by` (uuid, fk → `profiles.id`, nullable — which recruiter/manager/admin
added this candidate; app write paths should always set it),
`date_added`, `last_updated` (legacy, kept alongside `created_at`/`updated_at`
for existing app code), `created_at`, `updated_at`.
_The old `contact_info`/`education`/`certifications` jsonb blobs are gone,
replaced by the flat columns above plus the child tables below._

**candidate_work_experiences** — `candidate_id` (fk), `display_order` (0 =
most recent, unique per candidate), `company_name`, `title` (not null),
`employment_type` (enum), `location`, `is_remote`, `start_date` (not null),
`end_date`, `is_current`, `description`.

**candidate_education** — `candidate_id` (fk), `institution_name` (not null),
`degree`, `field_of_study`, `start_date`, `end_date`, `is_current`, `gpa`,
`description`.

**candidate_certifications** — `candidate_id` (fk), `name` (not null),
`issuing_organization`, `issue_date`, `expiry_date`, `credential_id`,
`credential_url` (url).

**candidate_links** — `candidate_id` (fk), `label`, `url` (not null),
`link_type`.

**skills** / **tools** (global lookups, shared across candidates)
`id` (uuid pk), `name` (unique), `skill_type` (enum, `skills` only),
`category` (text). _Was per-candidate free-text `skill_name`; now a
deduplicated, controlled lookup._

**candidate_skills** / **candidate_tools** (junctions)
`candidate_id` (fk), `skill_id`/`tool_id` (fk, restrict on delete),
`proficiency_level` (enum), `years_of_experience` (int), and on
`candidate_skills` only: `assessment_score` (numeric), `scorecard` (jsonb),
`ai_literacy_signal` (jsonb: tool_used/how_used/measurable_outcome).

### Client & job domain

**clients**
`client_id` (uuid pk), `client_name` (not null), `status` (enum), `notes`
(text), `industry` (text), `website_url` (url).

**job_orders**
`job_id` (uuid pk), `client_id` (fk), `title` (not null), `status` (enum,
default `draft`), `workplace_type` (enum), `office_location` (hidden when
workplace_type=remote), `location` (general, from Add Job dialog),
`description`, `description_file_path`, `requisition_file_path`, `company`,
`industry`, `job_function`, `employment_type` (enum), `experience_required`,
`education_required`, `salary_from`/`salary_to` (numeric), `salary_currency`
(default USD). _`required_skills`/`salary_range` jsonb are gone — superseded
by `job_competencies.skills[]` and the flat salary columns._

**job_notes** — `job_id` (fk), `content`, `file_path`.

**job_competencies** (Layer 1 — Evaluation Criteria)
`job_id` (fk), `type` (competency_type), `description` (not null),
`recommended_level` (fit_proficiency_level), `skills`/`tools` (text[] chip
lists). Referenced by scorecard + workflow sub-stages — never invented
elsewhere.

**job_competency_level_descriptions** — `competency_id` (fk), `level`
(fit_proficiency_level), `description` (not null). Unique(competency_id, level).

**job_scorecard_categories** (Layer 1 — Scorecard)
`job_id` (fk), `name`, `weight` (numeric %, must sum to 100 per job).

**job_scorecard_category_competencies** (junction)
`category_id` + `competency_id` (composite pk). Unique(competency_id) — a
competency belongs to exactly one category.

**job_team_members**
`job_id` (fk), `profile_id` (fk → profiles, nullable — set once the person
has a platform login), `name` (not null), `email` (not null), `role` (text:
Hiring Manager | Interviewer | HR Manager | Approver — client-defined,
distinct from `profiles.role`/`client_role`).

**pipeline_stages** (Tier 1 — fixed canonical, seeded exactly 5 rows)
`key` (pipeline_stage enum, unique), `name`, `description`, `display_order`,
`color`, `sla_target_days`. Never varies per job; exists so every job's
sub-stages roll up to a common set for cross-job audit.

**job_workflow_sub_stages** ("Job stages" in the UI — Tier 2, variable per job)
`job_id` (fk), `pipeline_stage_id` (fk → pipeline_stages, restrict — which
fixed Tier-1 stage houses this sub-stage), `name` (not null), `purpose`,
`duration_minutes`, `format` (stage_format), `questions`, `rating_scale`,
`allowed_outcomes` (text[]: advance/hold/reject/remove),
`needs_final_approval`, `display_order`, `config` (jsonb — flexible
per-sub-stage expansion without further migrations).

**job_workflow_sub_stage_details** — `sub_stage_id` (fk), `detail_type` (e.g.
instruction/attachment/question_set/criterion), `label`, `content`,
`file_path`, `metadata` (jsonb), `display_order`.

**job_workflow_sub_stage_competencies** / **job_workflow_sub_stage_reviewers**
(junctions) — link a sub-stage to the competencies it assesses and the
`job_team_members` reviewing it.

### Pipeline & evaluation

**applications** (link layer: candidate ↔ job)
`application_id` (uuid pk), `candidate_id` (fk), `job_id` (fk), `client_id`
(fk, denormalized), `current_stage_id` (fk → job_workflow_sub_stages, set
null — roll up via `pipeline_stage_id` for the canonical Tier-1 stage),
`status` (application_status, default `active`), `job_fit_score` (numeric,
role-relevance — distinct from candidate `data_confidence_score` and from
`candidate_client_fit.fit_score`), `status_reason` (text), `human_review_flag`
(bool, default false), `date_applied`, `date_updated`. Unique(candidate_id,
job_id). _The old fixed `stage` enum column is gone, replaced by
`current_stage_id` since workflow stages are now configurable per job._

**application_stage_evaluations** (Layer 2 — raw evidence)
One row per actual interview/meeting: `application_id` (fk), `sub_stage_id`
(fk), `status` (eval_status), `interviewer_id` (fk → job_team_members),
`interview_date`, `mode` (stage_format), `rubric_score`, `summary`.

**application_stage_evaluation_notes** — `evaluation_id` (fk), `note` (not
null), `display_order`.

**application_scorecard_categories** / **application_scorecard_competencies**
(Layer 3 — computed, system-generated per application by rolling up Layer 2
evidence against the job's Layer 1 template — never data entered directly)
Per application: `category_id`/`competency_id` (fk →
job_scorecard_categories/job_competencies), `current_score`/`target_score`,
`achieved_proficiency` (fit_proficiency_level), `confidence`, `summary`
(AI-synthesized), `data_provenance`. Unique per (application, category) and
per (category, competency).

**application_scorecard_evidence** — `scorecard_competency_id` (fk),
`evaluation_id` (fk → the specific Layer 2 meeting that produced this), `note`
(cited excerpt, not null).

**candidate_client_fit** (Layer 4 — redeployment, cross-job rollup)
`id` (uuid pk), `candidate_id` (fk), `client_id` (fk), `fit_score` (numeric),
`confidence` (enum), `rationale` (text), `data_provenance` (enum),
`last_evaluated_at`. Unique(candidate_id, client_id). Aggregates across *all*
of a candidate's applications with a client — not tied to one job.

**candidate_client_fit_evidence** — `fit_id` (fk), `scorecard_competency_id`
(fk → a real Layer 3 scored competency — never invented text at fit level),
`weight` (numeric).

**placements**
`placement_id` (uuid pk), `candidate_id` (fk), `client_id` (fk), `job_id` (fk),
`role_placed`, `salary` (numeric), `placement_date` (date), `guarantee_period`
(text), `status` (enum).

**interactions** (CRM log)
`interaction_id` (uuid pk), `candidate_id` (fk), `type` (enum), `body` (text),
`interaction_at` (timestamptz), `communication_preferences` (jsonb), `consent`
(bool), `relationship_strength` (numeric), `nurture_status` (enum).

### Auth

**profiles** (auth — one row per `auth.users` row, auto-created by trigger)
`id` (uuid pk, fk → `auth.users.id`), `email` (not null), `full_name`,
`avatar_url`, `role` (enum, Stellaforce-side only — now **nullable**, null
when side=client), `side` (enum, default `stellaforce`), `client_id` (fk →
`clients.client_id`, nullable — set for client-side profiles only),
`client_role` (enum, nullable — set for client-side profiles only),
`created_at`, `updated_at`. A check constraint enforces exactly one branch:
`side='stellaforce' AND role IS NOT NULL AND client_role IS NULL AND client_id
IS NULL`, or `side='client' AND role IS NULL AND client_role IS NOT NULL AND
client_id IS NOT NULL`. No public sign-up: users are created manually in the
Supabase dashboard (Auth → Users, Auto Confirm on); `handle_new_user()`
inserts the matching profile row defaulted to the Stellaforce side; `role`
(Stellaforce-side) or `side`/`client_id`/`client_role` (client-side, when
onboarding a new client) are hand-set afterward via SQL. All of this is
stored but **not yet enforced** — every authenticated user, Stellaforce or
client-side, has full CRUD via the existing permissive RLS policies.
Role-based and client-scoped restriction is a known, deferred follow-up pass.

### Indexes
FK indexes on every fk column across all tables above; filter indexes on
`candidates.candidate_tier`, `job_orders.status`; **ivfflat** on
`candidates.embedding_vector` (`vector_cosine_ops`, lists=100).

### Skill taxonomy note
`skills.name` is now a global, deduplicated lookup (was free-text
`skill_name` per candidate row). Starter list lives in `SKILL_TAXONOMY`
(`src/lib/constants.ts`) and steers AI parsing / seeds the lookup; the
taxonomy is now enforced at the DB level via `skills`/`tools` rather than by
convention alone.

### ⚠️ App code is out of sync with this schema
This migration changed table/column shapes that `src/lib/data.ts`,
`src/app/(app)/candidates/actions.ts`, `src/lib/ai/parse.ts`, and every
candidate/job component still reference under the old shape (`contact_info`
jsonb, `skill_name`, `current_title`, `applications.stage`, etc.). Updating
the application layer to match V3.2 is a separate, not-yet-started pass.

---

## Workflow specs

1. **Feed-in / ADD CANDIDATE (manual)** — a form → Server Action `addCandidate`
   writes a `candidates` row with `data_provenance = recruiter_confirmed`, sets
   `date_added`/`last_updated`/`freshness_score`, generates `embedding_vector`.
   _Implemented: `src/app/candidates/actions.ts`, `/candidates/new` (Manual tab)._

2. **INGESTION (AI + human confirm)** — two entry points:
   - **Paste text**: `/candidates/new` (AI tab) → Server Action `parseCandidate`
     calls Claude (`src/lib/ai/parse.ts`, structured outputs) → returns a
     pre-filled **editable** draft (`data_provenance = ai_parsed`) → recruiter
     edits/confirms → `createCandidateFromParsed` writes candidate + skills,
     **flips provenance to `recruiter_confirmed`**, generates embedding.
     _Implemented._
   - **Resume upload**: `AddCandidateDialog` (`/candidates` toolbar) → client
     uploads the file directly to the `resumes` Storage bucket
     (`src/lib/resume-upload.ts`, raw XHR for progress reporting; path
     `{user_id}/{timestamp}-{filename}`) → Server Action `notifyResumeUploaded`
     POSTs `{storage_path, user_id, filename}` to the n8n webhook
     (`N8N_WEBHOOK_URL`, header `Authorization: Bearer N8N_WEBHOOK_SECRET`) for
     parsing. _Upload + dispatch implemented; n8n's parsed response is not yet
     consumed — no `resumes` row is written, no draft is shown, and the
     candidate is not created. That wiring (n8n → draft review → confirm →
     `resumes`/`candidates` write, mirroring the paste-text path above) is the
     next step._

3. **ADD-TO-ORDER / REFER & UPDATE** — attach a candidate to a `job_order` as an
   `application`; advance `current_stage_id` through the job's
   `job_workflow_sub_stages`; log `interactions`; maintain `candidate_client_fit`
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
0007 client profiles → V3.2 migrations: new enums, skills/tools
restructure, candidates normalization, clients/job_orders/applications
alterations, Layer 1-4 job/eval/scorecard/fit tables, candidate child
tables, profiles two-sided identity, indexes + RLS for all new tables).
Applied directly via the Supabase MCP (`apply_migration`); pull the schema
history with the Supabase CLI (`supabase db pull`) to sync local migration
files if needed. RLS is minimal: authenticated users read/write all core
tables (including the V3.2 additions) via a permissive `ALL` policy per
table — **except `profiles`**, which only has a `SELECT`-for-authenticated
policy; profile rows are written exclusively by the `handle_new_user()`
security-definer trigger, never by an authenticated user's own request.
Anonymous users get nothing (PII not public); the service-role key bypasses
RLS for privileged operations (seeding, backfills).

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

## Storage
Supabase Storage bucket **`resumes`** (private, `public = false`) holds
uploaded resume binaries — PDF/DOC/DOCX only (`allowed_mime_types`), 10 MB
cap (`file_size_limit`). Objects are namespaced per **candidate**, not per
uploader (candidates have no login): path is
`{candidate_id}/{timestamp}-{filename}.ext`, matching `resumes.storage_path`
below. RLS on `storage.objects` is uniform across select/insert/update/delete
— open to any authenticated user with `profiles.side = 'stellaforce'`;
client-side profiles have no access at all. (There is no per-object
"owner" restriction — a folder-per-uploader scheme was tried first but
doesn't fit a candidate-keyed path, since any Stellaforce user may need to
replace a candidate's resume regardless of who originally uploaded it.)

**resumes** (candidate resume history — Postgres table, metadata only)
`id` (uuid pk), `candidate_id` (fk → `candidates.candidate_id`, cascade
delete), `storage_path` (not null — the Storage object path described
above), `filename` (not null, original upload name), `file_size` (bigint,
nullable), `mime_type` (nullable), `parsed_data` (jsonb, nullable —
structured output from the n8n resume-parsing webhook), `parse_status`
(text, default `pending`, check `pending | parsed | failed` — a plain check
constraint rather than a Postgres enum, unlike every other status field in
this schema), `parse_error` (text, nullable — set when `parse_status =
failed`), `is_current` (bool, default true — a partial unique index
enforces at most one current resume per candidate), `version` (int, default
1), `superseded_at` (timestamptz, nullable — set when a newer upload
replaces this one as current), `created_at`/`updated_at`. RLS: permissive
`ALL` for any authenticated user, matching every other V3.2 table (access
control for the actual file bytes lives at the Storage layer above, not
here). The `candidates.resume_path` column predates this table and is
superseded by it — not yet removed, not yet wired up app-side (see Build
order).
