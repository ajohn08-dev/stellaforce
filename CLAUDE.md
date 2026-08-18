# Stella Force — Project Context (source of truth)

AI-native recruiting platform for recruiters. This file is the **frozen source of
truth** for schema, vocabularies, workflows, and conventions. Keep it in sync with
`supabase/migrations/` and `src/lib/supabase/types.ts` — if they disagree, this
file wins and the others must be corrected.

**Companion references:** [DB_Schema.md](DB_Schema.md) — every table, column,
enum, function, trigger, index, and RLS policy. [n8n.md](n8n.md) — the register
of n8n workflows (triggers, dependent app functions, runtime-DB consequences).
[home.md](home.md) — the `/home` route per profile: widget-by-widget purpose,
content, and example copy for the recruiter mission-control, client-admin
oversight-console, internal-admin operations-command-center, and
client-recruiter delivery-workbench layouts.
[COMPANY.md](COMPANY.md) — the `/companies` workspace: information architecture,
screen-by-screen spec, component inventory, target data model, agent-context
assembly rules, and UX copy for the company knowledge base.

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

## Data model

Postgres + pgvector on Supabase. UUID PKs (`gen_random_uuid()`), `created_at`
everywhere, `updated_at` (trigger-maintained) where rows mutate, snake_case,
Postgres enums for every controlled vocabulary. **47 tables.**

**Shape.** A two-tier pipeline (fixed Tier-1 `pipeline_stages` → variable
per-job Tier-2 `job_workflow_sub_stages`) and a four-layer evaluation model —
L1 job template (`job_competencies`, `job_scorecard_*`) → L2 raw evidence
(`application_stage_evaluations`) → L3 computed per-application scorecard
(`application_scorecard_*`) → L4 cross-job fit (`candidate_client_fit`).
Candidates + skills/tools (global lookups) + child tables form the candidate
domain; `applications` is the **sole** candidate↔job link
(`unique(candidate_id, job_id)`), and every candidate added to a job becomes one.

**Workflow templates & settings** layer on top: reusable `workflow_templates` +
`workflow_template_sub_stages` (Stellaforce-global or per-client) are
**snapshotted** into a job's `job_workflow_sub_stages` at publish, freezing the
job's pipeline so later template edits don't touch live jobs. Cross-cutting
settings (`workflow_settings`, `sla_policies`, `automation_rules`,
`communication_templates`) inherit via a **global → client → workflow → job**
cascade (resolver: `src/lib/workflow-settings.ts`). `activity_events` is the
unified append-only log + transactional outbox (realizes the V3 doc's
`application_events` with wider scope), with `audit_log` + `ai_interactions` for
governance / AI-activity. These template/settings/activity/AI/audit tables use
**tenant-scoped RLS** (client users see only their own client's rows + globals),
unlike the permissive `authenticated`-ALL policy on the core tables.

> **Full reference — every table, column, enum, function, trigger, index, and
> RLS policy — is in [DB_Schema.md](DB_Schema.md).** Keep it in sync with
> `supabase/migrations/` and `src/lib/supabase/types.ts`; if they disagree, this
> file (CLAUDE.md) wins and the others must be corrected.

**⚠️ Legacy app-code drift.** Some candidate/job components still reference
pre-V3.2 shapes (`contact_info` jsonb, `skill_name`, `applications.stage`);
migrating the full app layer to V3.2 is an ongoing pass.

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
     (`N8N_WEBHOOK_URL`, header `Authorization: Bearer N8N_WEBHOOK_SECRET`),
     which extracts text, calls the LLM, and separately calls back into
     `POST /api/candidates/ingest` with the structured result. All persistence
     (candidate/resume/skills/tools/experience writes) happens on the Next.js
     side in that route handler — n8n itself no longer writes to Supabase.
     _Implemented: `src/app/api/candidates/ingest/route.ts`,
     `src/lib/server/candidate-ingest.ts`, `src/lib/ingest/{schema,normalize}.ts`.
     There is no recruiter draft-review step for this path (unlike paste-text
     above) — writes happen directly with `data_provenance = ai_parsed`;
     incomplete/ambiguous parses are written anyway and flagged via
     `ingestion_jobs.status = 'needs_review'` / `resumes.parse_status =
     'needs_review'` rather than blocked, so a recruiter can review afterward.
     There is no recruiter-facing "review ingestion jobs" UI yet — that's the
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
- `/home` — role-gated; see **[home.md](home.md)** for the full widget-by-widget
  spec of every variant. Stellaforce-side recruiters (`profiles.side =
  'stellaforce'`, `role = 'recruiter'`) get `RecruiterHome` — the mission
  control layout: Momentum, Today's Focus, Risks, Bench Strength, Agent
  Health, and a chat drilldown (`src/components/home/recruiter-home.tsx`,
  mock data in `src/lib/mock-home.ts`). Stellaforce-side internal admins
  (`side = 'stellaforce'`, `role = 'admin'`) get `InternalAdminHome` — the
  operations-command-center layout: Momentum, Today's Focus, Risks &
  Accountability, Platform Health, Team & Client Performance, and a chat
  drilldown (`src/components/home/internal-admin/internal-admin-home.tsx`,
  mock data in `src/lib/mock-internal-admin-home.ts`). Client-side admins
  (`side = 'client'`, `client_role = 'admin'`) get `ClientAdminHome` — the
  oversight-console layout: Momentum, Today's Focus, Risks & Accountability,
  Coverage, Hiring Performance, and a chat drilldown
  (`src/components/home/client-admin/client-admin-home.tsx`, mock data in
  `src/lib/mock-client-home.ts`). Client-side recruiters (`side = 'client'`,
  `client_role = 'recruiter'`) get `ClientRecruiterHome` — the delivery-workbench
  layout: Momentum, Today's Focus, Risks & Accountability, Coverage, Funnel
  Health, and a chat drilldown
  (`src/components/home/client-recruiter/client-recruiter-home.tsx`, mock
  data in `src/lib/mock-client-recruiter-home.ts`). All four are UI-only for
  now — no data pipeline wired up yet. Every other profile (Stellaforce
  manager, client-side reviewer/hiring_manager) gets `GenericHomeOverview` —
  the original candidate/job/client counts view
  (`src/components/home/generic-home-overview.tsx`)
- `/candidates` — TanStack Table list + structured filters
- `/candidates/[id]` — profile view
- `/candidates/new` — ingestion flow (manual + AI)
- `/jobs` — list (was `/job-orders`)
- `/jobs/[id]` — the job workspace. One tab row (`JobWorkspaceTabs`): **Pulse**
  first — open days / active candidates / average time per stage, then the
  job's activity feed and the suggested actions derived from it
  (`src/lib/job-pulse.ts`, all computed server-side) — followed by one tab per
  sub-stage of the job's snapshotted pipeline, each listing the applications
  parked there. A draft job renders the 5-step setup wizard instead.
- `/companies` — the company knowledge base (formerly `/clients`, which now
  redirects; the nav entry stays **bottom-pinned** with Integrations/Workflows,
  since a company profile is edited occasionally, not daily). A list page —
  **table by default**, `?view=grid` for cards — plus a per-company workspace at
  `/companies/[id]`. Company knowledge is reusable across every job for that
  company and is the grounding context candidate-facing screening agents are
  compiled from.

  The workspace sits in **one white card** (matching `/candidates/[id]`) and
  navigates by a **left rail of four collapsible groups**, not tabs (`?section=`
  drives it, so every section is deep-linkable). Only the group you're in is open
  on load: **Unanswered questions** (an inbox, above the groups) → *About the
  company* (Profile · What they do · Culture & working style · Why
  join) → *Pay, benefits & policies* (Locations & work model · Benefits · Work
  authorization · Compensation approach) → *Teams & jobs* (Departments & teams ·
  Jobs) → *Internal notes* (Recruiter brief · Activity log), the last group
  omitted entirely for profiles without the capability.
  Section order and labels live in
  `src/components/companies/workspace/company-sections.ts`.

  **There is no FAQ library.** Candidate questions live inside the section that
  answers them, routed by `faqSection()` — sponsorship questions under Work
  authorization, size questions under Profile — because editing a fact and
  editing the answer about that fact is one job. Only the unanswered queue is its
  own destination.

  **The knowledge base serves two audiences, not one.** `agentCanUse(item,
  audience)` takes `'candidate' | 'internal'`: `cleared_for_candidates` passes
  both, `recruiters_only` passes internal only, `restricted` passes neither. The
  ladder always meant that; reading it as a boolean is what made agents working
  *alongside* recruiters invisible in this model. The `agentUse` dial
  (proactive / on_request / reference_only / escalate) is candidate-only by
  construction, so an `escalate` item reaches an internal agent in full while a
  candidate agent gets only the topic and the handoff. `compileAgentContext(company,
  job, audience)` compiles per audience through that one gate — no second code
  path.

  **"What the agent knows" is a real surface** (`shared/agent-knowledge-panel.tsx`),
  on the job drilldown, with a Candidate / Internal toggle: says proactively ·
  answers if asked · policies · hands back to you · never says · withheld. Flip
  the toggle and the withheld items move up into the list, which explains the
  clearance ladder better than any badge. It replaced a collapsed disclosure that
  was company-scoped, candidate-only, and reachable solely inside the Publish
  dialog — so *"what will the agent say on this job?"* had no destination.

  **Some answers are derived, never stored** (`derivedAnswers` / `withDerived`).
  A job's reporting line, travel, location, typical week, role purpose, and
  **pipeline stages** are already typed on the job and are word-for-word the
  answers to six catalog questions. They synthesise at job scope marked
  `derivedFrom`, and any answer a recruiter actually writes for that job beats
  them. This is what stops the interview process being authored twice: the
  company's prose and the stages the pipeline will really run could disagree, and
  the candidate — not the recruiter — is who finds out.

  **Publish says what agents still can't answer** per active job
  (`jobAnswerGaps`), sensitive topics first. A warning, never a gate: a screen
  with gaps is normal and escalation is a designed outcome, but silence was
  worse than either.

  **⚠️ The compiled bundle still doesn't reach a live agent.**
  `interviewConfigFromContext()` (`src/lib/interview-agent-config.ts`) is the
  seam — it turns a candidate bundle into the agent's company name, permitted
  answers, handoff topics, prohibitions, and fallback — but nothing calls it yet,
  because it needs a `Company` for the job being screened and company profiles are
  still mock with no key shared with `job_orders`. Real screening calls read the
  hand-written fixture in that file, where `companyName` defaults to the literal
  "Stellaforce". Until that join exists, **none of this affects what a candidate
  hears.**

  **The nav passes the same test.** *"Why they're hiring"* was two questions in
  one label — a company growth story (real, company-level) and *"why is **this**
  req open?"* (backfill vs new territory, no honest company-wide answer). The
  question moved to the role, the section became **Why join** — the pitch: EVP,
  why they're growing, what makes them distinct, why now. Two leaks got fixed on
  the way: `evp` sat in *Culture & working style* while `why_join_now` sat in the
  other section, though both are pitch; and `role_family_context` moved to Teams,
  where `Team.commonRoleFamilies` already lived. `market_positioning` joined
  *What they do*, pairing with the competition question. `Locations` keeps
  remote and travel — a company default is genuinely true there and the job
  override handles the rest, which is the cascade doing its job rather than the
  nav needing to.

  **One rule places everything: a question lives where its answer can be true.**
  `Question.answerableAt` is `'company'` or `'job'`. Company-answerable questions
  render in the topical section that answers them (`faqSection`); **job-only
  questions never appear in a company section at all** — they live on the role,
  beside the pipeline and overrides that decide them (`questionsForJob`). There
  is no Interview process section: the process is a per-job snapshot, so a
  company page about it could only host a sentence that's wrong for every role
  that doesn't match. Its pieces went where each was true — the pipelines to the
  job, the never-promise-a-date rule into the catalog as locked prohibitions on
  both process questions, the client-reliability note to the Recruiter brief, and
  the readiness check from a company-level "is there an interview answer" to a
  per-job `role_process` ("does this role have stages").

  **A candidate only ever hears about the teams their own role sits under.**
  `compileAgentContext` walks `teamPath(job.teamId)`, so a sibling team the
  candidate isn't applying to never enters the bundle — for either audience. The
  compile always did this; what was missing was the UI saying it, so "Cleared for
  candidates" on a team read as *every* candidate when it has only ever meant
  candidates on the roles beneath it. Team cards now carry that reach
  (`jobsUnderTeam`) as the audience, not a statistic: *"Cleared for candidates on
  1 role"*, and a team with no role under it says *"— but no role sits under
  this, so no candidate hears it"* in amber. The dry run plants a sentinel
  sibling team and fails if its content reaches the bundle.

  **`npm run knowledge-dryrun`** walks a job from wizard fields to a live
  instance and back out through edits (`scripts/company-knowledge-dryrun.ts`),
  calling the same functions the UI renders from. It's how the model gets
  checked without a browser; it caught three real bugs on its first run —
  derived answers being pasted field fragments rather than sentences, a
  role-specific custom question leaking onto every role, and the Jobs list
  saying "nothing missing" for a job whose publish dialog listed two unanswered
  sensitive topics.

  **A new req arrives with its knowledge space already populated.** The catalog
  is projected onto the company and `withDerived` fills in what the job's own
  fields answer, so there is nothing to seed and nothing to assign — the gaps a
  new job shows are real gaps, not setup. **Only active roles (open/draft) are
  ever listed**, in the Jobs section, the scope menus, the inbox, and the
  publish warnings: nothing is screening for a closed req, so its gaps aren't
  work.

  **The inbox counts the way the work divides** (`unansweredItems`): a
  company-answerable question is one row — answer it once, every role is covered
  — while a job-only question is **one row per active role**, labelled with the
  role. Answering "how long will this take?" for the Central AE says nothing
  about the Data Engineer, and a single row claiming otherwise is how two of
  three roles stay uncovered.

  **Questions are global; answers are scoped.** The catalog
  (`src/lib/question-catalog.ts`) is the one thing shared across *every*
  customer — intent, phrasings, category, `sensitive` risk class, default agent
  posture, and standing prohibitions. Companies own only answers. That split is
  what makes this scale past one customer: a new company inherits the whole
  catalog with no answers, so its Unanswered inbox is the intake checklist on
  day one; a `sensitive` question arrives escalate-by-default carrying its
  prohibitions, so company #40 is safe because the catalog is; a question first
  asked at one company is promoted once and every other company sees it; and
  "sponsorship unanswered at 7 of 12 companies" is one query. **Answers are
  never shared between customers** — not as templates, not as "copy from a
  similar company" — because that is exactly how an agent states another
  client's policy.

  **The cascade is `global → company → team … team → job`**, resolved by
  `src/lib/company-inheritance.ts` — the same shape
  `src/lib/workflow-settings.ts` already uses for workflow settings. Three
  entity types, not four levels: **`Department` merged into a self-nesting
  `Team`** (`parentTeamId`), so Go-to-Market › Channel Growth is two teams and
  depth is data. That removes a decision nobody could make correctly ("is this a
  department or a team?") and lets a customer have one tier or four with no
  schema change. Two rules, deliberately different: **answers override**
  (nearest scope wins, `resolveAnswer`), **prohibitions accumulate**
  (`effectiveProhibitions` — unioned, never removable, or a job-level answer
  could quietly drop "never guarantee sponsorship"). Every surface — the stack
  on screen, readiness, and `compileAgentContext` — calls that one module, so
  the badge saying where an answer comes from and the answer the agent uses
  can't diverge.

  **On screen it's an indented stack**, widest first, narrowest marked as the
  winner, under one sentence: *"The most specific answer wins."* Nobody learns
  the word "scope". "Answer differently…" lists each scope with its blast radius
  ("For everyone in Go-to-Market · 3 jobs"), because choosing a scope is only
  answerable if you can see what it reaches. On a job the same data reads
  inverted — one resolved answer per question with a `From company` /
  `From Channel Growth` / `Set for this role` badge, and an override can only be
  written directly underneath the answer it replaces.

  **There is also no separate "knowledge gap" type.** An unanswered question is
  a `CompanyQuestion` with no written answer at any scope — same type, same
  list, already sitting in the section `faqSection()` routes it to. `isUnanswered()` / `unansweredQuestions()`
  (`src/lib/company-readiness.ts`) are the entire test, derived and never
  stored, so nothing has to be *filed* into a section when it's answered: the
  row was there all along and simply stops matching the filter. Draft state also
  means every published-only sweep (agent context, staleness, unverified claims)
  skips it for free — a question with no answer asserts nothing. **Unanswered
  questions** is therefore a *filter over `company.faq`*, not a store: it renders
  the same `QuestionRow` as the section does, bound to the same draft keys, so
  answering it in either place is one edit (and each inbox row is scoped to its
  owning section, so the publish review lists it under Work authorization rather
  than under the inbox). The gone-for-good fields are `status` (a five-state
  enum nothing advanced), `assignedOwner` (assignment with no queue,
  notification, or "mine" filter — the assignee was always the account owner in
  the header), and `proposedLevel` (asked before the answer was written; the
  level is inferred from where you answer it). What replaces ownership is
  `askedClientAt` — *we're blocked on someone outside the tool, and since when*.
  The two non-answer exits are "Ask the client" (sets that date) and "Hand to a
  recruiter" (sets `agentUse: 'escalate'`, giving the agent defined behaviour on
  the topic rather than a hole).

  **Activity is a projection of `activity_events`**, not a company-owned history,
  and there is deliberately **no per-item history drawer and no per-item
  provenance strip**. Both were answering rarely-asked questions with
  always-present chrome. The `VisibilityBlock` still stores `source` /
  `verifiedBy` / `lastVerifiedAt` / `nextReviewAt` / `owner` — readiness needs
  them — but the only thing rendered on an item is `TrustWarning`, which is
  silent unless the item is stale or an unconfirmed candidate-facing claim. Its
  `needsAttention()` predicate is shared with the rail's attention dots so the
  two can't disagree. Everything else is answered by filtering the one
  append-only log.

  **Every field is editable in place** (`shared/editable-field.tsx` — text,
  textarea, select, and add/remove pills, all styled to look like plain text
  until hovered). Edits are batched across the **whole company**, not per
  section: the buffer lives in `companies/[id]/layout.tsx` (a `?section=` change
  re-renders the page but preserves the layout, so unsaved edits survive moving
  between sections), and **Publish in the header is the primary CTA** — the only
  thing that applies them, showing a review list grouped by section first.
  Version history is company-wide, since a publish is atomic across every
  section; it is **UI-only** in this pass. Leaving the company with unpublished
  edits warns first (`UnsavedChangesGuard` — `beforeunload` plus a capture-phase
  click interceptor, since the App Router has no navigation guard); moving
  between sections never warns, because the buffer survives it.

  **Vocabulary matches between code and UI**: `Clearance` is
  `cleared_for_candidates` / `recruiters_only` / `restricted`, rendered with
  exactly those words. Don't reintroduce "audience" or "candidate-safe" — the
  earlier mismatch is what let "Candidates can see this" survive in the UI while
  the type said something else. Visibility reads as a
  sentence with inline dropdowns — *"Cleared for candidates, and the agent
  answers only if asked"* — not as a pair of jargon badges. The audience axis is
  worded as a **clearance ladder** (Cleared for candidates / Recruiters only /
  Restricted), not as "who can see this": candidates have no login and only ever
  hear things from an agent.

  Every knowledge item carries a two-axis visibility block — **clearance**
  (`cleared_for_candidates` / `recruiters_only` / `restricted`) and **agent use** (`proactive` /
  `on_request` / `reference_only` / `escalate`) — plus a separate publication
  state. The agent gate is the single predicate `agentCanUse()` in
  `src/lib/company-visibility.ts`; note it is deliberately distinct from
  `isPublishedCleared()`, which the readiness *existence* checks use so
  stale knowledge reports as "needs review" rather than as missing.

  There is **no Readiness screen** and **no "Deploy agent" action** — both were
  redundant. Readiness duplicated the header's completeness meter; deploy was
  fiction, since agents attach to a job stage
  (`job_workflow_sub_stages.agent_id`), never to a company, and publishing is
  already what makes company knowledge available to every agent on that
  company's jobs. Gap counts now ride on the rail (`gapCountsBySection()`),
  items needing re-confirmation on rail dots (`attentionSections()`), the
  specific problem inside the section it concerns, the readiness explanation in the
  header pill's tooltip, and the compiled agent context as a collapsed
  disclosure inside Publish. The header itself is **identity and actions only** —
  completeness percentages live on the list page, where comparing companies is
  the actual job. The real agent gate belongs on the job stage — see
  the Missing link note under **Interview channels**.

  Departments and teams are optional and created only when an active job needs
  them (`createdBecauseJobId` records which); each team shows how many jobs still
  use its context, so an orphaned one is visible.

  **The Jobs section is coverage, not a directory.** `/jobs` is already the jobs
  dashboard and owns that data; what a knowledge base can answer instead is
  *which roles an agent still can't screen for, and why* — so each row carries
  the job's open problems (`jobCoverage()`, derived from the same `JOB_CHECKS`
  array as the readiness checks, so a row and a rail badge can't disagree) and
  links out to `/jobs/[id]`, with "What it inherits" opening the inheritance
  drilldown. **⚠️ The two job models aren't linked yet**: `/jobs` reads
  `job_orders` joined to `clients`, this reads `CompanyJob[]` from
  `mock-companies.ts`, and they share no key — so the link is real markup against
  fixture ids that won't resolve until the DB pass, where `CompanyJob.id` becomes
  `job_orders.job_id`. Two more things to reconcile there: there is no
  `companies` table (the DB has `clients`), and `Company.stakeholders` describes
  the same humans as the real `job_team_members` rows — the company should own
  the *person* (bio, clearance, notes), the job the *assignment*.

  **UI only** — renders from `src/lib/mock-companies.ts`, no tables or Server
  Actions yet. Full spec: **[COMPANY.md](COMPANY.md)**.
- `/settings` — signed-in user's email/role
- `/search` — Filters (structured) + Semantic (stub) tabs (not in main nav)
- `/interview-room/[agentId]` — browser interview room: a briefing/device-check
  screen, then a live audio conversation with an ElevenLabs agent presented in a
  video-call frame (local camera preview + agent tile + live transcript). Sits
  **outside** the `(app)` route group — full-viewport, no sidebar/header — but is
  still behind auth via `src/proxy.ts`. The camera is preview-only; video is
  never transmitted. Reached from the Agents page test-run dialog. See
  **Interview channels** below.
- `/login` — email/password sign-in

## Interview channels (phone vs. room)

An AI screening stage can reach a candidate two ways. **The channel is a
property of the stage, not of the agent** — an ElevenLabs conversational agent
is channel-agnostic, and the same agent row can run either way. The channel
lives in `job_workflow_sub_stages.format` (`stage_format`: `phone | video |
onsite | async`) alongside `interviewer_type = 'ai'`; there is deliberately **no
modality column on `agents`**, which would be a second, competing source of
truth.

| | Outbound leg | Implementation |
|---|---|---|
| **Phone** (`format = 'phone'`) | App → n8n → ElevenLabs places a call | `triggerAgentTestCall` / `triggerApplicationScreeningCall` (`src/app/(app)/agents/actions.ts`) |
| **Room** (`format = 'video'`) | Browser → ElevenLabs directly | `createInterviewRoomSession` (`src/app/interview-room/actions.ts`) mints a client token; `@elevenlabs/react` runs the conversation |

**The two converge on the return leg.** ElevenLabs fires the same post-call
webhook either way, so a room conversation lands in `call_recordings` as an
ordinary `interviewer_type = 'ai'` row and appears on the Conversations page
next to phone calls with no extra plumbing — `to_number` is simply null.

**A room interview produces two recordings, from two sources.** The ElevenLabs
audio (both participants) lands via the webhook below into the `call-recordings`
bucket. The candidate's **camera** never reaches ElevenLabs at all — it is
captured in the browser with `MediaRecorder`, uploaded straight to Storage via a
signed upload URL (never through a Server Action; the files are tens of MB), and
linked onto the same row via `call_recordings.video_storage_path`. It is
**silent by design**: the mic belongs to the ElevenLabs SDK for the duration of
the call, and its audio is the better track anyway. Video lives in its own
**`video-recordings`** bucket (500 MB cap, video MIME types, RLS mirroring
`call-recordings`) rather than beside the audio — size, retention clock, and
access sensitivity all differ. `video_url` is unrelated to either: it stays a
plain external link for third-party-hosted stages.

That webhook is received by **`POST /api/calls/postcall`**
(`src/lib/server/elevenlabs-postcall.ts`), HMAC-verified with
`ELEVENLABS_POSTCALL_WEBHOOK_SECRET`. ElevenLabs delivers each conversation as
**two payloads**: `post_call_transcription` creates the row, then
`post_call_audio` (base64 MP3) is uploaded to the `call-recordings` bucket and
linked onto it. Both are keyed on `elevenlabs_conversation_id`, so redelivery
is idempotent. **The webhook needs retries enabled** — an audio payload that
beats its transcript gets a 409 and must be redelivered, and without retries
that recording is lost. Configure it workspace-wide in ElevenLabs; it is not
per-agent and not per-channel. Telling the channels apart needs no column: the room passes a
`channel: 'video_room'` dynamic variable, which rides in
`raw_elevenlabs_payload` and is read back via `payloadDynamicVariable()`
(`src/lib/data.ts`). Note that ElevenLabs dynamic variables cannot be null, so
the room's absent id fields carry `""` where the phone path's `CallDispatchPayload`
carries `null`.

The Agents-page test dialog offers **both** channels for every agent, since the
channel is picked per job stage rather than baked into the agent.

**⚠️ Missing link.** `job_workflow_sub_stages.agent_id` /
`workflow_template_sub_stages.agent_id` exist in the schema but **no UI ever
sets them** — the workflow stages tab lets you pick `interviewer_type = 'ai'`
and a format, but not *which* agent. Until an agent picker exists, a real
candidate can't be launched into either channel from a job; only the Agents-page
test runs work.

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

## ⚠️ QA test fixtures — DELETE BEFORE LAUNCH

Fourteen placeholder candidates exist **only** to exercise pipeline-stage flows on
the **Product Designer** job (`308f4d06-8b28-4d3f-b824-e93ecde00db7`). They are
**not** real people and must be removed once the flows are designed.

**Identified by `candidates.source = 'qa_test_fixture'`** — that column is the
deletion key; don't rely on the names. All fourteen share Anna's real phone
(`+1-412-626-2245`) and LinkedIn URL, and use plus-addressed variants of her
email (`ajohndesign08+qa1@gmail.com` … `+qa14`) because `candidates.email` is
UNIQUE and all plus-addresses deliver to the same inbox. **Anything that dials
or emails these rows will reach Anna's real phone/inbox** — keep that in mind
when testing outbound calling.

Two candidates sit on each of the seven Screen/Interview sub-stages:
Pre-Screening, Recruiter Screen, HR Interview, Hiring Manager Interview, Who
Interview, Technical Interview, Panel Interview. (Source/Offer/Close have none.)
Each one also carries seeded L2 evaluations for every stage it has already
cleared, each with Q&A, a transcript and a stand-in audio recording — see
`20260808130000_seed_stage_evaluations_qa_fixtures` and
`20260808140100_seed_evaluation_qa_and_transcripts` below. Deleting the
fixtures cascades all of it; the Storage objects under
`call-recordings/applications/{application_id}/` are the one thing that has to
be removed by hand.

To remove them — `applications` cascades on `candidates` delete, so one
statement is enough:

```sql
delete from public.candidates where source = 'qa_test_fixture';
```

## Migrations
SQL lives in `supabase/migrations/`, applied directly via the Supabase MCP
(`apply_migration`); `supabase db pull` syncs local files. History: `0001`–`0007`
(extensions/enums, tables, indexes, RLS, auth roles, `candidates.added_by`,
client profiles) → the **V3.2** set (new enums, skills/tools restructure,
candidate normalization + child tables, Layer 1–4 job/eval/scorecard/fit tables,
two-sided profiles, indexes/RLS) → resumes bucket/table →
`20260727120000_ingestion_pipeline` (`ingestion_jobs`, idempotency uniques,
`source_resume_id`) → `20260727130000_skills_tools_case_insensitive` → the
**workflow-templates feature**: `20260728100000_wf_enums`, `_100100_wf_templates`
(templates + sub-stages, promoted columns on `job_workflow_sub_stages`,
`job_orders.workflow_template_id`/`_version`), `_100200_wf_settings` (settings
cascade + seeded globals), `_100300_wf_activity_runtime` (`activity_events`,
`application_stage_history`, `audit_log`, `ai_interactions`,
`applications.owner_profile_id`), `_100500_wf_tenant_rls` (`current_profile_*`
helpers + tenant-scoped RLS + denormalized `client_id` on settings tables) →
`20260807140000_call_recordings_storage_bucket`/`_140100_call_recordings_storage_policies`/
`_140200_create_call_recordings_table` (`call-recordings` bucket + `call_recordings`
metadata table) → `_171904_add_agents_interviews_conversations` (`agents` table;
also created `interviews`/`conversations` tables, superseded below) →
`_173038_reconcile_call_recordings_with_agents` (dropped `interviews`/
`conversations` in favor of extending `call_recordings` with agent/candidate/
job/campaign linkage + the ElevenLabs post-call payload fields, and upgraded
its RLS from permissive to tenant-scoped) → `20260807180000_call_recordings_two_phase_audio`
(`storage_path`/`filename` made nullable + added `audio_status`, so the
transcript payload can create the row before the later audio payload updates
it) → `20260808120000_seed_screening_agents` (seeds the six screening agents
the Agents page used to render from mock data, so `call_recordings.agent_id`
has real rows to reference; `external_agent_id` left null until each is
created in ElevenLabs — see
[DB_Schema.md](DB_Schema.md#storage--resume-ingestion)) →
`20260808130000_seed_stage_evaluations_qa_fixtures` (backfills L2
`application_stage_evaluations` + `_notes` for the QA fixture candidates — one
completed evaluation per sub-stage *before* the one each candidate currently
sits in, so the pipeline board's Evaluation/Overview tabs have something to
render; scoped to `candidates.source = 'qa_test_fixture'`, so it is a no-op
without the fixtures and disappears when they are deleted) →
`20260808140000_evaluation_questions` (`application_stage_evaluation_questions`
— the per-interview Q&A the evaluation panel's Q&A tab groups by competency) →
`20260808140100_seed_evaluation_qa_and_transcripts` (fixture Q&A + one
`call_recordings` row per fixture evaluation, transcript built from that
evaluation's own Q&A; audio is attached separately by
`npm run attach-fixture-audio`, which copies a real test-call clip into a
per-evaluation object path since SQL can't write Storage).

**RLS.** Permissive `authenticated`-ALL on core tables; **tenant-scoped** on the
workflow-template / settings / activity / AI / audit tables (client users see
only their own client's rows + globals); `profiles` is SELECT-only (rows written
by the `handle_new_user()` trigger). Anonymous: no access; the service-role key
bypasses RLS for privileged work (seeding, n8n ingestion). Full table / enum /
function / trigger / index / RLS reference: **[DB_Schema.md](DB_Schema.md)**.

## Auth
Supabase Auth, email/password only, no public sign-up — Stellaforce-side
recruiters/managers/admins and client-side members/admins are all created
manually in the dashboard. `src/proxy.ts` (Next.js 16's `middleware.ts`
convention) + `src/lib/supabase/middleware.ts` refresh the session and
redirect signed-out requests to `/login`. `src/lib/auth.ts`
(`getCurrentProfile`) resolves the signed-in user's `profiles` row
server-side; `src/app/login/` holds the login page and the `login`/`logout`
Server Actions. See the **profiles** table in
[DB_Schema.md](DB_Schema.md#auth) for role provisioning (Stellaforce-side) and
client onboarding (client-side); no public sign-up — users are created manually
in the Supabase dashboard and the `handle_new_user()` trigger inserts the
matching profile row (defaulted Stellaforce/recruiter, elevated by hand).

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

The **`resumes`** metadata/history table (columns in
[DB_Schema.md](DB_Schema.md#storage--resume-ingestion)) is keyed by a unique
`storage_path` (the ingestion idempotency key), with `is_current` (partial
unique — one current resume per candidate) and `parse_status`
(`pending|parsed|failed|needs_review`). `candidates.resume_path` predates it and
is superseded (not yet removed).

### Resume ingestion pipeline

**ingestion_jobs** (columns in [DB_Schema.md](DB_Schema.md#storage--resume-ingestion))
records one row per n8n resume webhook delivery, keyed by `storage_path` (unique
idempotency key), with `status`/`stage`/`attempt_count` for failure tracing.

`POST /api/candidates/ingest` (`src/app/api/candidates/ingest/route.ts`) is
the receiving end: bearer-auth'd with `N8N_WEBHOOK_SECRET`, validates the
payload with Zod (`src/lib/ingest/schema.ts`), normalizes it
(`src/lib/ingest/normalize.ts` — link normalization/backfill, employment-type
mapping, null-vs-empty handling, dropping rows that can't satisfy a NOT NULL
column instead of failing the whole ingestion), then calls
`ingestCandidateResume` (`src/lib/server/candidate-ingest.ts`), which runs a
sequence of individually-idempotent steps (candidate upsert by
email-then-linkedin_url identity → resume upsert by `storage_path` →
links upsert via `unique(candidate_id, url)` → tools/skills resolved
case-insensitively via `findOrCreateLookupRows` (the `skills`/`tools`
case-insensitive lookups — see [DB_Schema.md](DB_Schema.md)) then linked via
`unique(candidate_id, skill_id|tool_id)` → work
experience/education/certifications replaced by `source_resume_id`, never
touching recruiter-entered rows) using the service-role admin client, since
this is a privileged write with no acting recruiter session. Uses the admin
client rather than Postgres RPC/transaction: every step is independently
safe to retry (upsert-on-conflict or delete-scoped-by-source_resume_id), so a
crash mid-sequence converges to the same end state on redelivery without
needing true multi-statement atomicity.

## n8n integration
Resume ingestion is one of several n8n workflows. n8n handles **external
side-effects** (calendar, email, STT, enrichment) and **scheduled SLA/timer
crons**; pure state transitions stay in Server Actions. Event-driven workflows
drain the `activity_events` outbox (`dispatched_at IS NULL`); system events set
`actor_type='system'` + `system_source='n8n:<workflow>'`. The full register of
every workflow we have/need — triggers, the app functions that depend on each,
and their runtime-DB consequences (Jobs + related) — is in **[n8n.md](n8n.md)**.
