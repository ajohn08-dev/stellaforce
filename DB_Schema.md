# Stella Force — Database Schema Reference

Full reference for the Supabase Postgres schema: **tables, columns, enums,
functions, triggers, indexes, and RLS**. [CLAUDE.md](CLAUDE.md) is the
conceptual source of truth and links here for the detail; if the two disagree,
CLAUDE.md wins and this file must be corrected. Keep both in sync with
`supabase/migrations/` and `src/lib/supabase/types.ts`.

**Conventions.** UUID PKs via `gen_random_uuid()`. `created_at` on every table;
`updated_at` where rows mutate (maintained by a `BEFORE UPDATE` trigger — see
Functions & triggers). snake_case throughout. All controlled vocabularies are
Postgres enum types.

**Two-tier pipeline + 4-layer evaluation model.** Fixed Tier-1 `pipeline_stages`
(5 canonical stages) house variable per-job Tier-2 `job_workflow_sub_stages`.
Evaluation is layered: **L1** job template (`job_competencies`,
`job_scorecard_*`, sub-stages) → **L2** raw evidence
(`application_stage_evaluations`) → **L3** computed per-application scorecard
(`application_scorecard_*`) → **L4** cross-job redeployment fit
(`candidate_client_fit`).

**Table count:** 47 tables. Tables marked **[tenant RLS]** enforce
client-scoped row access; all others use the permissive `authenticated`-ALL
policy (see RLS model at the end).

---

## Enums (controlled vocabularies)

### Core (V3.2)
- `candidate_tier`: gold | silver | bronze
- `data_provenance`: ai_parsed | recruiter_confirmed | enriched
- `skill_type`: technical | functional | behavioral
- `proficiency_level`: beginner | intermediate | advanced | expert (candidate_skills/tools)
- `fit_proficiency_level`: aware | proficient | expert (job_competencies.recommended_level, achieved_proficiency)
- `confidence_level`: low | medium | high
- `client_status`: active | paused | churned
- `client_plan`: basic | standard | premium (stored, app-side enforcement TBD)
- `job_status`: draft | open | paused | filled | closed
- `competency_type`: technical | behavioral | hybrid | leadership
- `pipeline_stage`: source | screen | interview | offer | close (fixed Tier-1)
- `stage_format`: phone | video | onsite | async
- `rating_scale`: star | ten-point | hundred-point
- `employment_type`: full-time | part-time | contract | freelance | internship
- `workplace_type`: on-site | hybrid | remote
- `application_status`: active | hired | rejected | withdrawn | on_hold
- `eval_status`: pending | completed
- `placement_status`: active | completed | fell_through
- `interaction_type`: call | email | interview | note
- `nurture_status`: active | dormant | re_engaging
- `user_role`: recruiter | manager | admin (Stellaforce-side)
- `profile_side`: stellaforce | client
- `client_role`: member | admin | reviewer | recruiter (client-side)
- `url` (domain, not enum): `text` CHECK `value ~* '^https?://.+'` (new url columns only)

### Workflow-templates feature
- `stage_visibility`: internal | candidate_facing
- `stage_entry_condition`: manual | automatic (used as an **array** column, default `{automatic,manual}` = try automatic, fall back to manual)
- `interviewer_type`: human | ai | external
- `question_source`: manual | structured | ai_assisted
- `decision_mode`: single_rater | multi_rater
- `hire_recommendation`: strong_hire | hire | no_hire | strong_no_hire (final offer stage only; other stages reuse `rating_scale`)
- `scheduling_policy`: recruiter_led | candidate_self_scheduling | system_auto_schedule
- `workflow_template_status`: draft | published
- `settings_scope`: global | client | workflow | job (cascade axis)
- `actor_type`: user | system | candidate
- `event_severity`: info | action_needed | alert
- `activity_event_type`: 31 V3 lifecycle events (`application_created` … `application_reopened`) + candidate/job activity (`candidate_created`, `resume_ingested`, `job_created`, `job_published`, `job_workflow_snapshotted`)

---

## Candidate domain

**candidates** (core, 40 cols) — `candidate_id` (pk), `first_name`/`last_name` (not null),
`full_name` (generated), `headline`, `current_title`, `current_company`,
`professional_summary`, `email` (unique), `phone`, `location_city`/`_state`/
`_country`/`_raw`, `timezone` (IANA), `is_open_to_remote`, `is_open_to_relocation`,
`languages` (text[]), `years_experience` (int), `linkedin_url`, `portfolio_url`,
`github_url`, `resume_path`, `avatar_url`, `source`, `source_metadata` (jsonb),
`candidate_tier`, `tier_rationale`, `data_provenance` (default ai_parsed),
`data_confidence_score`, `data_confidence_breakdown` (jsonb), `freshness_score`,
`last_verified`, `last_scored_at`, `embedding_vector` (vector(1536)), `added_by`
(fk profiles, nullable), `date_added`, `last_updated` (legacy), `created_at`,
`updated_at`.

**candidate_work_experiences** — `candidate_id` (fk), `display_order` (0=most recent,
unique per candidate), `company_name`, `title` (not null), `employment_type`,
`location`, `is_remote`, `start_date` (not null), `end_date`, `is_current`,
`description`, `source_resume_id` (fk resumes, nullable — set on ingestion).

**candidate_education** — `candidate_id` (fk), `institution_name` (not null), `degree`,
`field_of_study`, `start_date`, `end_date`, `is_current`, `gpa`, `description`,
`source_resume_id` (fk resumes, nullable).

**candidate_certifications** — `candidate_id` (fk), `name` (not null),
`issuing_organization`, `issue_date`, `expiry_date`, `credential_id`,
`credential_url` (url), `source_resume_id` (fk resumes, nullable).

**candidate_links** — `candidate_id` (fk), `label`, `url` (not null), `link_type`.
Unique(candidate_id, url) — upsert-safe on ingestion retry.

**skills** / **tools** (global lookups) — `id` (pk), `name` (**case-insensitive
unique** via `unique(lower(name))`), `skill_type` (skills only), `category`.
Deduplicated controlled lookup shared across candidates.

**candidate_skills** / **candidate_tools** (junctions) — `candidate_id` (fk),
`skill_id`/`tool_id` (fk, restrict on delete), `proficiency_level`,
`years_of_experience`; `candidate_skills` also has `assessment_score`, `scorecard`
(jsonb), `ai_literacy_signal` (jsonb). Unique(candidate_id, skill_id|tool_id).

---

## Client & job domain

**clients** — `client_id` (pk), `client_name` (not null), `status`, `plan`
(default basic), `notes`, `industry`, `website_url` (url).

**job_orders** (23 cols) — `job_id` (pk), `client_id` (fk, **not null**), `title`
(not null), `status` (default draft), `workplace_type`, `office_location`,
`location`, `description`, `description_file_path`, `requisition_file_path`,
`company`, `industry`, `job_function`, `employment_type`, `experience_required`,
`education_required`, `salary_from`/`salary_to`, `salary_currency` (default USD),
**`workflow_template_id`** (fk workflow_templates, set null — the published-from
template) + **`workflow_template_version`** (int) — snapshot provenance.

**job_notes** — `job_id` (fk), `content`, `file_path`.

**job_competencies** (L1 evaluation criteria) — `job_id` (fk), `type`
(competency_type), `description` (not null), `recommended_level`
(fit_proficiency_level), `skills`/`tools` (text[]).

**job_competency_level_descriptions** — `competency_id` (fk), `level`, `description`
(not null). Unique(competency_id, level).

**job_scorecard_categories** (L1 scorecard) — `job_id` (fk), `name`, `weight`
(numeric %, must sum to 100 per job — **app-validated, not DB-enforced**).

**job_scorecard_category_competencies** (junction) — `category_id` + `competency_id`
(composite pk). **Unique(competency_id)** — a competency belongs to exactly one category.

**job_team_members** — `job_id` (fk), `profile_id` (fk profiles, nullable), `name`
(not null), `email` (not null), `role` (text: Hiring Manager | Interviewer | HR
Manager | Approver — client-defined).

**pipeline_stages** (Tier-1, seeded exactly 5) — `id`, `key` (pipeline_stage enum,
unique), `name`, `description`, `display_order`, `color`, `sla_target_days`.

**job_workflow_sub_stages** (Tier-2, per job — 28 cols) — `id`, `job_id` (fk),
`pipeline_stage_id` (fk pipeline_stages, restrict), `name` (not null), `purpose`,
`duration_minutes`, `format`, `questions`, `rating_scale`, `allowed_outcomes`
(text[]), `needs_final_approval`, `display_order`, `config` (jsonb), plus the
**snapshot-target columns** copied from a template on publish: `visibility`,
`owner_role`, `collaborator_role`, `entry_conditions` (stage_entry_condition[]),
`interviewer_type`, `question_source`, `required_questions`,
`capture_feedback_form`, `capture_transcript`, `decision_mode`, `decision_owner`,
`hire_recommendation_enabled`, `override_enabled`, `override_roles`.

**job_workflow_sub_stage_details** — `sub_stage_id` (fk), `detail_type`, `label`,
`content`, `file_path`, `metadata` (jsonb), `display_order`.

**job_workflow_sub_stage_competencies** / **job_workflow_sub_stage_reviewers**
(junctions) — link a sub-stage to competencies + reviewing `job_team_members`.

---

## Pipeline & evaluation (runtime)

**applications** (link layer, 14 cols) — `application_id` (pk), `candidate_id` (fk),
`job_id` (fk), `client_id` (fk, **not null**, denormalized), `current_stage_id`
(fk job_workflow_sub_stages, set null), `status` (default active), `job_fit_score`,
`status_reason`, `human_review_flag` (default false), **`owner_profile_id`** (fk
profiles, nullable — owning recruiter), `date_applied`, `date_updated`, `created_at`,
`updated_at`. **Unique(candidate_id, job_id)** — the only candidate↔job link.

**application_stage_evaluations** (L2 raw evidence) — `application_id` (fk),
`sub_stage_id` (fk), `status` (eval_status), `interviewer_id` (fk job_team_members),
`interview_date`, `mode` (stage_format), `rubric_score`, `summary`.

**application_stage_evaluation_notes** — `evaluation_id` (fk), `note` (not null),
`display_order`. Free-form reviewer commentary; written by the
`addEvaluationNote` Server Action behind the evaluation panel's Notes tab.

**application_stage_evaluation_questions** — `id` (pk), `evaluation_id` (fk
cascade), `competency_id` (fk job_competencies, **nullable**, set null),
`question` (not null), `answer`, `display_order`, `created_at`. The Q&A
captured during one interview, tied to the competency each question probed —
what the evaluation panel's Q&A tab groups by. A null `competency_id` is an
off-script question and groups under "Other questions". Permissive
`authenticated`-ALL RLS, matching its sibling evaluation tables.

A stage evaluation's **recording** is not a separate table: `call_recordings`
carries an `evaluation_id` fk, so the panel's media player and transcript read
the same row the Agent Conversations page does (see
[Storage & resume ingestion](#storage--resume-ingestion)).

**application_scorecard_categories** / **application_scorecard_competencies** (L3
computed) — per application, rolled up from L2 against the L1 template.
`category_id`/`competency_id` (fk), `current_score`/`target_score`,
`achieved_proficiency`, `confidence`, `summary`, `data_provenance`. Unique per
(application, category) and per (category, competency).

**application_scorecard_evidence** — `scorecard_competency_id` (fk), `evaluation_id`
(fk L2), `note` (cited excerpt, not null).

**candidate_client_fit** (L4 redeployment) — `id` (pk), `candidate_id` (fk),
`client_id` (fk), `fit_score`, `confidence`, `rationale`, `data_provenance`,
`last_evaluated_at`. Unique(candidate_id, client_id).

**candidate_client_fit_evidence** — `fit_id` (fk), `scorecard_competency_id` (fk L3),
`weight`.

**placements** — `placement_id` (pk), `candidate_id`/`client_id`/`job_id` (fk),
`role_placed`, `salary`, `placement_date`, `guarantee_period`, `status`.

**interactions** (candidate CRM log) — `interaction_id` (pk), `candidate_id` (fk),
`type` (interaction_type), `body`, `interaction_at`, `communication_preferences`
(jsonb), `consent`, `relationship_strength`, `nurture_status`. _Distinct from
`activity_events`: interactions = CRM touchpoints/consent/nurture; activity_events
= system pipeline/audit log._

---

## Workflow templates, settings & activity (feature)

Reusable pipelines defined on the Stellaforce side (global) or per client, then
selected when creating a job. On **job publish**, a template's sub-stages are
**snapshotted** into `job_workflow_sub_stages` and the resolved cross-cutting
settings are written as `scope='job'` rows — so a published job's workflow is
**frozen** and later template edits never touch live jobs.

**workflow_templates** **[tenant RLS]** (12 cols) — `id` (pk), `name` (not null),
`description`, `department`, `hiring_type` (employment_type), `status`
(workflow_template_status, default draft), `client_id` (fk clients, cascade —
**null = Stellaforce-global**), `created_by` (fk profiles, set null), `version`
(int, default 1), `config` (jsonb), `created_at`, `updated_at`.

**workflow_template_sub_stages** (27 cols) — `id` (pk), `template_id` (fk cascade),
`pipeline_stage_id` (fk pipeline_stages, restrict), `name` (not null), `purpose`,
`duration_minutes`, `format`, `visibility` (default internal), `owner_role`,
`collaborator_role`, `entry_conditions` (stage_entry_condition[], default
`{automatic,manual}`), `interviewer_type` (default human), `question_source`,
`required_questions`, `capture_feedback_form` (default true), `capture_transcript`
(default true), `decision_mode` (default single_rater), `decision_owner`,
`rating_scale` (the stage's decision scale), `hire_recommendation_enabled`
(default false — true on the offer stage), `override_enabled`, `override_roles`,
`allowed_outcomes` (text[]), `needs_final_approval`, `display_order`, `config`
(jsonb), `created_at`.

### Settings inheritance — cascade global → client → workflow → job (most-specific wins)
Every settings row carries `scope` (settings_scope) + `scope_id` (uuid, null when
global) + a denormalized `client_id` (fk clients, for tenant RLS). Global rows are
seeded defaults. Resolved by `resolveWorkflowSettings()` (`src/lib/workflow-settings.ts`).

**workflow_settings** **[tenant RLS]** (8 cols) — singleton config categories:
`id`, `scope`, `scope_id`, `category` (text: 'scheduling' | 'ai_capabilities' | …),
`config` (jsonb, deep-merged), `client_id`, `created_at`, `updated_at`.
Unique(scope, scope_id, category).

**sla_policies** **[tenant RLS]** (10 cols) — `id`, `scope`, `scope_id`, `sla_type`
(text), `threshold_hours` (int), `enabled` (default true), `config` (jsonb),
`client_id`, `created_at`, `updated_at`. Unique(scope, scope_id, sla_type).

**automation_rules** **[tenant RLS]** (10 cols) — `id`, `scope`, `scope_id`,
`trigger_event_type` (activity_event_type), `conditions` (jsonb), `actions` (jsonb,
default `[]`), `enabled`, `client_id`, `created_at`, `updated_at`.

**communication_templates** **[tenant RLS]** (12 cols) — `id`, `scope`, `scope_id`,
`trigger_event_type`, `channel` (text, default email), `subject`, `body`,
`recipients` (jsonb, default `[]`), `enabled`, `client_id`, `created_at`, `updated_at`.

### Runtime & compliance logs

**activity_events** **[tenant RLS]** (16 cols) — unified append-only log **and
transactional outbox**; realizes the V3 doc's `application_events` with wider scope.
`id`, `event_type` (activity_event_type), `client_id` / `candidate_id` / `job_id` /
`application_id` (all fk, nullable — denormalized for per-tenant/candidate/job
timelines + RLS), `sub_stage_id` (fk), `actor_type` (default user),
`actor_profile_id` (fk), `system_source` (text — e.g. `n8n:sla_cron`), `severity`
(default info), `payload` (jsonb), `reverses_event_id` (self-fk — compensation for
reopen), `idempotency_key` (text, **unique** — dedupes at-least-once redelivery),
`dispatched_at` (timestamptz — set when side-effects/n8n consumed it), `created_at`.
CHECK: at least one of candidate_id/job_id/application_id set.

**application_stage_history** (9 cols) — `id`, `application_id` (fk cascade),
`sub_stage_id` (fk cascade), `entered_at`, `exited_at`, `outcome` (text:
advance/reject/skipped/withdraw), `sla_breached` (default false), `decided_by`
(fk profiles), `created_at`.

**audit_log** **[tenant RLS]** (8 cols) — config governance trail: `id`,
`actor_profile_id` (fk), `client_id` (fk — null for global config), `entity_type`
(text: 'workflow_template' | 'workflow_settings' | …), `entity_id` (uuid),
`action` (text), `diff` (jsonb), `created_at`.

**ai_interactions** **[tenant RLS]** (14 cols) — AI telemetry + legal activity log
(EU AI Act high-risk: retain ≥6 months): `id`, `client_id` (fk), `application_id`
(fk), `candidate_id` (fk), `sub_stage_id` (fk), `capability` (text), `model`,
`prompt_version`, `input_ref` (jsonb), `output_ref` (jsonb), `tokens` (int),
`latency_ms` (int), `confidence` (numeric), `created_at`.

---

## Auth

**profiles** — one row per `auth.users`, auto-created by `handle_new_user()`.
`id` (pk, fk auth.users), `email` (not null), `full_name`, `avatar_url`, `role`
(user_role, nullable — Stellaforce-side only), `side` (profile_side, default
stellaforce), `client_id` (fk clients, nullable — client-side only), `client_role`
(nullable — client-side only), `created_at`, `updated_at`. Check constraint
`chk_profiles_side_consistency` enforces exactly one branch (stellaforce ⇒ role
set, client_role/client_id null; client ⇒ role null, client_role/client_id set).
No public sign-up. **RLS: SELECT-only for authenticated** — rows written solely by
the security-definer trigger.

---

## Storage & resume ingestion

**Storage bucket `resumes`** (private) — PDF/DOC/DOCX, 10 MB cap. Path
`{candidate_id}/{timestamp}-{filename}.ext`. `storage.objects` RLS: any
`profiles.side='stellaforce'` user; client-side profiles have no access.

**resumes** (metadata, 14 cols) — `id` (pk), `candidate_id` (fk cascade),
`storage_path` (not null, **unique** — idempotency key), `filename` (not null),
`file_size`, `mime_type`, `parsed_data` (jsonb), `parse_status` (text CHECK
`pending | parsed | failed | needs_review`), `parse_error`, `is_current` (default
true — partial unique index: one current resume per candidate), `version` (default
1), `superseded_at`, `created_at`, `updated_at`.

**ingestion_jobs** (15 cols) — one row per n8n resume webhook delivery, keyed by
`storage_path` (unique — idempotency). `id` (pk), `storage_path` (not null,
unique), `filename` (not null), `user_id` (fk profiles), `status` (text CHECK
`received | processing | completed | failed | needs_review`), `stage`,
`error_message`, `needs_review_reasons` (text[]), `candidate_id`/`resume_id` (fk),
`attempt_count` (default 1), `webhook_execution_mode`, `raw_payload` (jsonb, not
null), `created_at`, `updated_at`. Receiving endpoint: `POST /api/candidates/ingest`
(`src/app/api/candidates/ingest/route.ts`).

**Storage bucket `call-recordings`** (private) — broad audio set (mpeg/wav/
mp4/m4a/ogg), 100 MB cap. Two path shapes: `applications/{application_id}/
{interviewer_type}/{timestamp}-{filename}.ext` for real recordings tied to a
job+candidate pairing (`interviewer_type`: `ai | human | external`, same enum
as `job_workflow_sub_stages`/`workflow_template_sub_stages`), and
`test/{timestamp}-{filename}.ext` for screening-agent test-run calls (dummy
candidate identity — no real application). `storage.objects` RLS: any
`profiles.side='stellaforce'` user gets full read/upload/update/delete on both
prefixes; client-side profiles get **read-only**, scoped to `applications/...`
rows whose `application_id` resolves to their own `current_profile_client_id()`
— no client access to `test/...` at all.

**Storage bucket `video-recordings`** (private) — `video/webm`, `video/mp4`,
`video/x-matroska`; **500 MB** cap. Holds the candidate's camera recording from
a browser interview room, captured with `MediaRecorder` and uploaded straight
from the page via a signed upload URL (the file never passes through a Server
Action). Silent by design — the microphone belongs to the ElevenLabs SDK during
the call, and its audio covers both participants. Same two path shapes and the
same `storage.objects` RLS as `call-recordings` above, so client-side access
stays scoped to their own `applications/...`. Deliberately a **separate bucket**
rather than sharing `call-recordings`: video is 10–100x the size (a shared
bucket forces one `file_size_limit` on both), a candidate's likeness may need a
shorter retention clock than their voice, and biometric-adjacent media benefits
from its own policy surface. The join back is
`call_recordings.video_storage_path` — one row still describes the whole
interview; only the bytes live elsewhere.

**agents** **[tenant RLS-like — see RLS model]** (9 cols) — minimal registry
for externally-hosted screening agents (e.g. an ElevenLabs conversational
agent): `id` (pk), `name` (not null), `description`, `status` (enum
`agent_status`: `active | inactive`, default `active`), `provider` (text, not
an enum — deliberate, an evolving external-integration detail rather than a
fixed vocabulary), `external_agent_id` (the agent's ID in that external
platform), `avg_handle_time_minutes`, `created_at`, `updated_at`. No
per-client ownership column — "which clients use this agent" is derived by
joining `job_workflow_sub_stages.agent_id` → `job_orders` → `clients`.
Referenced by `job_workflow_sub_stages.agent_id` /
`workflow_template_sub_stages.agent_id` (nullable — which agent conducts an
`interviewer_type='ai'` stage, snapshotted at publish same as
`interviewer_type` itself) and by `call_recordings.agent_id` below.

**call_recordings** **[tenant RLS]** (31 cols) — one row per interview/call
instance, human or AI, real candidate or test. `id` (pk), `application_id` (fk
applications, cascade, nullable — null for test-run rows), `evaluation_id` (fk
application_stage_evaluations, set null), `sub_stage_id` (fk
job_workflow_sub_stages), `client_id` (fk clients, denormalized for RLS),
`candidate_id` / `job_id` (fk candidates/job_orders, denormalized, null for
test calls), `agent_id` (fk agents, set when AI-conducted), `campaign_id`,
`to_number`, `interviewer_type` (not null), `is_test` (default false; check
constraint forbids `is_test` with a non-null `application_id`, and a second
check constraint requires `agent_id` when `is_test`), `storage_path`
(**unique** — idempotency key; nullable, since the transcript payload creates
the row before the audio file exists), `filename` (nullable, same reason),
`audio_status` (text CHECK `pending | uploaded | failed`, default `pending` —
set once the audio payload arrives and the recording has been fetched and
uploaded to the bucket), `file_size`, `mime_type`, `duration_seconds`,
`started_at`, `elevenlabs_conversation_id` (unique, nullable — only AI-agent
rows have one), `call_status`, `call_successful` (ElevenLabs' own
vocabularies, stored as-received, not constrained to an app enum), `title`,
`summary`, `termination_reason`, `transcript_text` (flattened plain text),
`transcript` (jsonb — structured turns), `transcript_status` (text CHECK
`pending | transcribed | failed`), `video_url` (video-capable stages only,
plain link — not owned like audio), `raw_elevenlabs_payload` (jsonb, full
webhook body for audit/replay), `created_at`, `updated_at`. Two-phase writer:
the transcript payload (`post_call_transcription`) arrives first and
upserts the row keyed by `elevenlabs_conversation_id`; a later audio payload
updates that same row with `storage_path`/`filename`/`mime_type`/`file_size`/
`audio_status`. **Written by `POST /api/calls/postcall`**
(`src/app/api/calls/postcall/route.ts` + `src/lib/server/elevenlabs-postcall.ts`)
— the inbound ElevenLabs post-call webhook receiver, HMAC-verified with
`ELEVENLABS_POSTCALL_WEBHOOK_SECRET`. It is channel-agnostic: browser
interview-room and Twilio phone conversations arrive as the same event, and a
room call is distinguishable only by `to_number IS NULL` (no phone leg). Audio
is decoded from base64 MP3 and uploaded to the `call-recordings` bucket by the
service-role client, then linked back onto the row. If audio arrives before its
transcript there is no identity to build a storage path from, so the route
answers **409** and relies on webhook retries being enabled.

---

## Functions & triggers

### Application functions
| Function | Returns | Security | Purpose |
|---|---|---|---|
| `handle_new_user()` | trigger | **definer** | On new `auth.users` row, insert the matching `profiles` row (defaulted Stellaforce/recruiter). |
| `set_updated_at()` | trigger | invoker | `NEW.updated_at = now()`. |
| `set_candidate_timestamps()` | trigger | invoker | Sets `updated_at` + legacy `last_updated`. |
| `set_application_timestamps()` | trigger | invoker | Sets `updated_at` + `date_updated`. |
| `current_profile_side()` | `profile_side` | **definer** (`search_path=''`) | Caller's `profiles.side` by `auth.uid()` — used in tenant RLS policies. |
| `current_profile_client_id()` | uuid | **definer** (`search_path=''`) | Caller's `profiles.client_id` — used in tenant RLS policies. Execute granted to `authenticated` only. |

_(The `pgvector` extension also installs many `vector_*`/`halfvec_*`/distance
functions in `public` — not application code.)_

### `updated_at` triggers (BEFORE UPDATE)
`set_candidate_timestamps` → candidates. `set_application_timestamps` → applications.
`set_updated_at` → clients, job_orders, placements, interactions, candidate_client_fit,
resumes, ingestion_jobs, profiles, **workflow_templates, workflow_settings,
sla_policies, automation_rules, communication_templates**, call_recordings,
agents.

---

## Indexes
FK indexes on every fk column. Filter indexes on `candidates.candidate_tier`,
`job_orders.status`. **ivfflat** on `candidates.embedding_vector`
(`vector_cosine_ops`, lists=100). Scope indexes on the settings tables
(`scope, scope_id` + `client_id`). Denormalized-scope indexes on `activity_events`
(`client_id`, `candidate_id`, `job_id`, `application_id`, `event_type`, `created_at`)
plus a partial index `where dispatched_at is null` (outbox drain).

## RLS model
- **Permissive** (`FOR ALL TO authenticated USING(true) WITH CHECK(true)`, 1 policy)
  on all core/V3.2 tables — coarse; role/client enforcement across these is a known
  deferred pass.
- **profiles** — SELECT-only for authenticated (written by the trigger).
- **Tenant-scoped** (2 policies: `tenant_read` SELECT + `tenant_write` ALL) on
  `workflow_templates`, `workflow_settings`, `sla_policies`, `automation_rules`,
  `communication_templates`, `activity_events`, `ai_interactions`, `audit_log`,
  `call_recordings`. Read: Stellaforce **or** row is global (`client_id` null)
  **or** `client_id = current_profile_client_id()`. Write: Stellaforce **or**
  `client_id = current_profile_client_id()` (client users can't create global rows).
  (`call_recordings.client_id` is nullable and only populated once a row is
  linked to a real application — test-call rows have no `client_id` and are
  invisible to client-side users, which is intentional: they're internal QA.)
- **agents** — a variant, not the standard tenant pair: `read_agents` (SELECT,
  `USING(true)`) lets any authenticated user see agent name/status (harmless —
  a client-side user may see one assigned to their job's AI stage);
  `stellaforce_write_agents` (ALL) restricts writes to
  `current_profile_side() = 'stellaforce'` — agents are Stellaforce-managed,
  not client-owned.
- Anonymous users: no access. The service-role key bypasses RLS (seeding, backfills,
  n8n ingestion route).

## Extensions
`vector` (pgvector) — installed in `public` (advisor flags this; move to a dedicated
schema in a future pass).
