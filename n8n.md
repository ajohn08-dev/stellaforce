# Stella Force — n8n Workflows

Record of every n8n workflow the project **has** or **needs**, with its trigger,
the app code that depends on it, and its consequences in the runtime DB. Cross-ref
with [CLAUDE.md](CLAUDE.md) (architecture), [DB_Schema.md](DB_Schema.md) (tables),
and the **Candidate Lifecycle V3 doc** (the 31 events + the "n8n Email Triggers"
sheet).

n8n plays exactly two roles; everything else stays in Postgres/Server Actions:
1. **External side-effects** — calendar, email/SMS, speech-to-text, enrichment.
2. **Scheduled (cron) SLA/timer jobs** — overdue evaluations, stuck candidates,
   offer expiry, interview reminders.

Pure state transitions + audit logging are **not** n8n — they run in Server
Actions (`src/app/(app)/jobs/actions.ts`, `.../workflows/actions.ts`) writing
`activity_events` synchronously. n8n consumes those events; it doesn't own state.

---

## Integration architecture

### Config
- **`N8N_WEBHOOK_URL`**, **`N8N_WEBHOOK_SECRET`** — `src/lib/env.ts`
  (`serverEnv.n8nWebhookUrl` / `.n8nWebhookSecret`, server-only). Outbound POSTs
  send `Authorization: Bearer ${N8N_WEBHOOK_SECRET}`; inbound callbacks are
  bearer-auth'd with the same secret.

### Outbound: Next → n8n (two paths)
1. **Direct webhook** — a Server Action POSTs to `N8N_WEBHOOK_URL` inline. Used
   today by resume ingestion (`notifyResumeUploaded`).
2. **Transactional outbox** — event-driven workflows drain
   **`activity_events`** where **`dispatched_at IS NULL`** (partial index
   `idx_activity_events_undispatched`). A dispatcher (Supabase **Database
   Webhook** on insert, or an n8n cron that polls the outbox) forwards each
   event to the matching workflow, then stamps `dispatched_at = now()`. This
   guarantees at-least-once delivery with no lost/double side-effects, because
   the event + the state change were written in the same request, and
   `activity_events.idempotency_key` dedupes redeliveries. _(Dispatcher not built
   yet — see Follow-on.)_

### Inbound: n8n → Next (bearer-auth'd callback routes)
- **`POST /api/candidates/ingest`** (`src/app/api/candidates/ingest/route.ts`) —
  live. Validates with `RawIngestPayloadSchema` (`src/lib/ingest/schema.ts`),
  runs `processIngestionItem` (`src/lib/server/candidate-ingest.ts`). Returns
  `{ok, results}` (200 / 207 partial / 401 / 422).
- Planned callbacks (see workflows below): transcript ingest, calendar sync,
  enrichment result.

### What n8n reads for content/config
- **`communication_templates`** — email subject/body/recipients, keyed by
  `trigger_event_type` (+ channel), resolved through the settings cascade
  (a job carries `scope='job'` rows written at publish).
- **`sla_policies`** — `threshold_hours` per `sla_type` for the cron jobs
  (job-scoped rows override global; `pipeline_stages.sla_target_days` is the
  Tier-1 stage SLA).
- **`job_workflow_sub_stages`** (stage config incl. `interviewer_type`,
  `format`, competencies) + **`job_team_members`** (recipients/interviewers).

### System-actor convention
Every n8n-fired event sets `actor_type='system'`, `actor_profile_id=NULL`, and
`system_source='n8n:<workflow>'` (e.g. `n8n:sla_cron`) — keeps the audit trail
clean and traceable. Human events carry a `profile_id`.

---

## Workflow register

Status legend: **✅ Live** · **🟡 Ready** (all DB tables/hooks exist, workflow +
dispatcher to build) · **⛔ Blocked** (needs a follow-on runtime table).

| # | Workflow | Type | Trigger | App code it depends on | DB writes / runtime consequences | Status |
|---|---|---|---|---|---|---|
| 1 | **Resume ingestion** | webhook + callback | Resume uploaded to `resumes` bucket → `notifyResumeUploaded` POST | `resume-upload.ts`, `notifyResumeUploaded` (`candidates/actions.ts`), `/api/candidates/ingest`, `candidate-ingest.ts` | `candidates`, `resumes`, `ingestion_jobs`, candidate child tables; should also emit `resume_ingested` / `candidate_created` to `activity_events` | ✅ Live (event emit TODO) |
| 2 | **Interview scheduled** | outbox → calendar + email | `activity_events.interview_scheduled` | (interview actions — follow-on) reads `communication_templates`, `job_team_members` | Sends calendar invite + logistics email; arms reminder + `evaluation_overdue` timers | ⛔ needs `interviews` |
| 3 | **Interview reminder + prep** | cron (T-24h, T-1h) | `interviews.scheduled_at` window | reads candidate profile + `job_workflow_sub_stage_competencies` (focus areas) | Emails interviewer prep packet + candidate reminder; inserts `interview_reminder_sent` (system) | ⛔ needs `interviews` |
| 4 | **Scorecard link** | outbox → email | `activity_events.interview_completed` | secure-token generation; `communication_templates` | Emails reviewer an expiring scorecard/transcript link; inserts `scorecard_link_sent` (system) | ⛔ needs `interviews` |
| 5 | **Transcript / STT** | callback (Deepgram/ElevenLabs) | STT webhook or manual upload | `POST /api/interviews/transcript` (to build) | Writes `interview_transcripts`, sets `interviews.transcript_status`; inserts `transcript_submitted`; embeds for search | ⛔ needs `interview_transcripts` |
| 6 | **Evaluation overdue** | cron (`n8n:eval_cron`, daily) | `interview_completed` ≥24h ago AND eval still `pending` | reads `application_stage_evaluations`, `sla_policies` (`needs_feedback`) | Inserts `evaluation_overdue` (severity=alert); re-sends scorecard link; escalates to recruiter+HR | ⛔ needs `interviews` + evals wired |
| 7 | **Stage SLA breached** | cron (`n8n:sla_cron`, daily) | open `application_stage_history` where `now()-entered_at > threshold` | reads `application_stage_history`, `sla_policies` / `pipeline_stages.sla_target_days`, `applications.owner_profile_id` | Inserts `stage_sla_breached` (alert); optional `sla_breached=true` on the history row; emails owner + HR | 🟡 Ready |
| 8 | **Offer lifecycle emails** | outbox → email | `offer_created` / `offer_accepted` / `offer_declined` / `offer_rescinded` | (offer actions — follow-on); `communication_templates` | Sends offer / acceptance / decline / rescind comms | ⛔ needs `offers` |
| 9 | **Offer expired** | cron (`n8n:offer_cron`) | `offers.status='created' AND now() > expiry_date` | reads `offers` | `offers.status='expired'`; inserts `offer_expired` (alert); escalates to recruiter | ⛔ needs `offers` |
| 10 | **Candidate enrichment** | webhook + callback | manual/scheduled enrich request | `POST /api/candidates/ingest` (or a dedicated route) | Updates `candidates.*` + child tables; inserts `candidate_data_updated`; re-embeds vector | 🟡 Ready (route reuse) |
| 11 | **Voice-agent pre-screen** | outbox → voice agent + callback | candidate enters a `interviewer_type='ai'` **Pre-Screening** sub-stage | Voice-agent platform; STT | Produces an `interviews` row + transcript; logs `ai_interactions` (model/tokens/confidence); sets `applications.human_review_flag=true` (never auto-advances) | ⛔ needs `interviews`/`interview_transcripts` |
| 12 | **Voice-agent "Who" interview** | outbox → voice agent + callback | candidate enters the `interviewer_type='ai'` **Who Interview** (video) sub-stage | Voice-agent platform; STT | Same as #11 (video) | ⛔ needs `interviews`/`interview_transcripts` |

---

## Runtime DB consequences — Jobs & related functions

Which tables each workflow touches (R = reads, **W** = writes). Grouped by the
job/application runtime.

| Table | Read/written by |
|---|---|
| `activity_events` | **W** by every workflow (system events) + the source of truth the outbox drains (`dispatched_at`) |
| `applications` | R (owner, stage, status) by 2,4,6,7,9,11,12; **W** `human_review_flag` by 11,12 |
| `application_stage_history` | R by **Stage SLA (7)**; **W** `sla_breached` flag (7) |
| `sla_policies` / `pipeline_stages.sla_target_days` | R by crons 6,7,9 (thresholds) |
| `communication_templates` | R by all email workflows (2,3,4,6,8) for subject/body/recipients |
| `job_workflow_sub_stages` | R by 2,3,11,12 (`interviewer_type`, `format`, competencies) |
| `job_team_members` | R by 2,3 (interviewers/recipients) |
| `interviews` *(follow-on)* | **W** by 2,3,4,5,11,12 |
| `interview_transcripts` *(follow-on)* | **W** by 5,11,12 |
| `offers` *(follow-on)* | **W** by 8,9 |
| `ai_interactions` | **W** by 11,12 (AI telemetry + EU AI Act log) |
| `candidates` + child tables | **W** by 1,10 (ingestion/enrichment) |
| `resumes` / `ingestion_jobs` | **W** by 1 |

**Server Actions that emit the events n8n consumes** (`src/app/(app)/jobs/actions.ts`):
- Already emitting: `application_created`, `candidate_added_to_stage`,
  `candidate_advanced`, `candidate_leaves_stage`, `candidate_rejected`,
  `candidate_withdraws`, `application_closed`, `job_published`,
  `job_workflow_snapshotted` (from `addCandidateToPipeline`, `moveCandidate`,
  `rejectCandidate`, `withdrawCandidate`, `publishJob`).
- **Pending** (need interview/offer actions): `interview_*`, `scorecard_link_sent`,
  `transcript_submitted`, `offer_*`. Crons (`evaluation_overdue`,
  `stage_sla_breached`, `offer_expired`) are inserted by n8n itself, not app code.

---

## Dependencies & follow-on (to unblock the ⛔ workflows)

1. **Outbox dispatcher** — a Supabase Database Webhook on `activity_events`
   INSERT (or an n8n polling cron over `dispatched_at IS NULL`) that routes to
   the right workflow and stamps `dispatched_at`. Nothing event-driven fires
   until this exists.
2. **Runtime tables** (planned in the workflow-templates plan's follow-on):
   `interviews`, `interview_transcripts`, `offers`, `application_notes` — unblock
   workflows 2–6, 8–9, 11–12.
3. **Callback routes** to build: `/api/interviews/transcript` (STT),
   `/api/calendar/sync` (calendar webhooks), enrichment result (reuse
   `/api/candidates/ingest` or add `/api/candidates/enrich`).
4. **Delivery DLQ** — a `communication_deliveries` log (status/attempt/error/
   dedupe, mirroring `ingestion_jobs`) so failed emails are visible + retryable.
5. **Voice-agent contract** — pick the provider (Deepgram / ElevenLabs for STT)
   and define the callback payload → `interviews` + `interview_transcripts` +
   `ai_interactions`.

Guardrail: workflows 11–12 (AI stages) must **never** auto-advance or auto-reject
— they set `applications.human_review_flag` and log `ai_interactions` (EU AI Act
high-risk: human oversight + ≥6-month activity retention).
