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
- **`N8N_CALENDAR_WEBHOOK_URL`** (`serverEnv.n8nCalendarWebhookUrl`) — the
  calendar-consent-invite workflow's webhook, same auth as above. Defaults to
  `https://ajzenarate.app.n8n.cloud/webhook/calendar-connect-invite` (live),
  overridable via env like the other webhook URLs.
- **`GOOGLE_CLIENT_ID`** / **`GOOGLE_CLIENT_SECRET`** — the Google Cloud OAuth
  2.0 Web Client backing the calendar consent flow (Calendar API enabled,
  scope `calendar.events`, redirect URI `${SITE_URL}/api/calendar/oauth/callback`).
- **`CALENDAR_TOKEN_ENCRYPTION_KEY`** — AES-256-GCM key (base64, 32 bytes) for
  encrypting stored refresh tokens; **`CALENDAR_STATE_SECRET`** — separate HMAC
  key for signing the OAuth `state` param; **`SITE_URL`** — absolute origin
  used to build the redirect URI and invite links. All server-only, all in
  `src/lib/env.ts`.

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
- **`POST /api/calendar/token`** (`src/app/api/calendar/token/route.ts`) — live.
  n8n calls this right before making a Calendar API call on someone's behalf;
  returns a short-lived access token (never the refresh token) minted from the
  stored `google_calendar_connections` row. On refresh failure, marks the
  connection revoked and re-sends the connect invite (see #13 below).
- Planned callbacks (see workflows below): transcript ingest, enrichment
  result.

### Google OAuth redirect (not n8n — Google calls this directly)
- **`GET /api/calendar/oauth/callback`** (`src/app/api/calendar/oauth/callback/route.ts`)
  — Google redirects here after a team member grants/denies calendar access.
  Not part of the n8n integration; documented here because it's the other half
  of workflow #13's consent loop.

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
| 7 | **Stage SLA breached** | cron (`n8n:sla_cron`, daily) → `POST /api/cron/sla-check` | open `application_stage_history` where `now()-entered_at > threshold` | `src/app/api/cron/sla-check/route.ts` (finds breaches, records them, returns email list); n8n = Schedule → HTTP Request → IF → Split Out → Email | Inserts `stage_sla_breached` (system, alert, once/day via idempotency_key); sets `sla_breached=true`; emails owner + HR | ✅ Live |
| 8 | **Offer lifecycle emails** | outbox → email | `offer_created` / `offer_accepted` / `offer_declined` / `offer_rescinded` | (offer actions — follow-on); `communication_templates` | Sends offer / acceptance / decline / rescind comms | ⛔ needs `offers` |
| 9 | **Offer expired** | cron (`n8n:offer_cron`) | `offers.status='created' AND now() > expiry_date` | reads `offers` | `offers.status='expired'`; inserts `offer_expired` (alert); escalates to recruiter | ⛔ needs `offers` |
| 10 | **Candidate enrichment** | webhook + callback | manual/scheduled enrich request | `POST /api/candidates/ingest` (or a dedicated route) | Updates `candidates.*` + child tables; inserts `candidate_data_updated`; re-embeds vector | 🟡 Ready (route reuse) |
| 11 | **Voice-agent pre-screen** | outbox → voice agent + callback | candidate enters a `interviewer_type='ai'` **Pre-Screening** sub-stage | Voice-agent platform; STT | Produces an `interviews` row + transcript; logs `ai_interactions` (model/tokens/confidence); sets `applications.human_review_flag=true` (never auto-advances) | ⛔ needs `interviews`/`interview_transcripts` |
| 12 | **Voice-agent "Who" interview** | outbox → voice agent + callback | candidate enters the `interviewer_type='ai'` **Who Interview** (video) sub-stage | Voice-agent platform; STT | Same as #11 (video) | ⛔ needs `interviews`/`interview_transcripts` |
| 13 | **Calendar consent invite** | webhook (3 triggers) | `reason='added'` — team member added → `addJobTeamMember`/`publishJob`; `reason='resend'` — recruiter clicks **Resend invite** in the job workspace Team dialog → `resendCalendarConnectInvite`; `reason='reconnect'` — `/api/calendar/token` refresh failure | `sendCalendarConnectInvite` (`src/lib/server/calendar-invite.ts`), `resendCalendarConnectInvite` (`src/app/(app)/jobs/actions.ts`), `/api/calendar/oauth/callback`, `/api/calendar/token` | Emails the "connect your Google Calendar" invite (direct webhook, like #1 — no-op if that email already has an active connection); Google's own redirect back to `/api/calendar/oauth/callback` writes `google_calendar_connections` + `calendar_connected`; `/api/calendar/token` refresh failures write `calendar_connection_revoked` + re-fire this same invite. Resends write **nothing** — no `activity_events` row, no per-send column; the n8n execution log is the record | 🟡 Live-ish (app side live; webhook responding, but the Webhook node has no Header Auth and there's no Respond node — see spec below) |

### Implemented: Stage SLA breached (#7) — the reference pattern
n8n owns only the schedule + the email; the app does the DB thinking + recording.
This is the template for future crons.

- **n8n:** Schedule Trigger (daily) → HTTP Request → IF (`count > 0`) → Split Out (`breaches`) → Send Email.
- **Endpoint:** `POST /api/cron/sla-check` (`src/app/api/cron/sla-check/route.ts`),
  bearer-auth'd with `N8N_WEBHOOK_SECRET`, service-role client (system job, no user).
  - **Request body:** none.
  - **Does:** finds open `application_stage_history` rows past the job's effective
    `needs_attention` SLA (job-scope `sla_policies` → global, default 72h); for each,
    upserts an `activity_events` row (`stage_sla_breached`, `actor_type='system'`,
    `system_source='n8n:sla_cron'`, `severity='alert'`, `idempotency_key`
    `stage_sla_breached:<app>:<stage>:<date>` → once/day) and sets
    `application_stage_history.sla_breached=true`.
  - **Returns:** `{ ok, count, breaches: [{ candidate_name, client_name, job_title,
    stage_name, days_in_stage, sla_days, owner_name, owner_email, hr_email }] }`.
- **n8n Cloud caveat:** it cannot reach `localhost`; use the deployed Vercel URL
  (add `N8N_WEBHOOK_SECRET` to Vercel env) or a tunnel for local testing.

### Calendar consent invite (#13) — one workflow, three triggers
**Status (probed 2026-08-08):** the webhook is live at
`…/webhook/calendar-connect-invite` and registered for POST, but two node
settings are still open:
1. **The Webhook node has no authentication.** An unauthenticated
   `POST {"probe":true}` was accepted and executed the workflow — anyone with
   the URL can trigger invite emails. Set Authentication → **Header Auth**
   (`Authorization` = `Bearer <N8N_WEBHOOK_SECRET>`); the app already sends
   that header on every call.
2. **No Respond to Webhook node exists**, but the webhook is set to respond via
   one — it returns `500 {"message":"No Respond to Webhook node found in the
   workflow"}`. The app reads a non-2xx as `webhook_failed`, so the recruiter's
   Resend toast reports failure even when the mail goes out. Either add the
   Respond nodes (#7 below) or switch the webhook's Respond setting to
   *Immediately*.

The app owns identity, the signed consent link, and the already-connected check;
n8n owns only the email. All three triggers hit the **same** webhook and differ
only by `reason`, so there is one workflow and one email template to maintain.

- **App → n8n:** `POST ${N8N_CALENDAR_WEBHOOK_URL}`,
  `Authorization: Bearer ${N8N_WEBHOOK_SECRET}`, 15s client timeout, fired by
  `sendCalendarConnectInvite`. Body:

  ```jsonc
  {
    "reason": "resend",              // "added" | "resend" | "reconnect"
    "email": "annaj@stellaforce.com",
    "name": "Anna John",
    "role": "Hiring Manager",        // job_team_members.role; may be null
    "job_id": "308f4d06-…",
    "job_title": "Product Designer", // may be null
    "client_name": "Acme Corp",      // may be null
    "team_member_id": "…",           // job_team_members.id
    "connect_url": "https://accounts.google.com/o/oauth2/v2/auth?…",
    "connect_url_expires_at": "2026-08-15T12:00:00.000Z",
    "sent_by_name": "Anna John",     // null on the system "reconnect" path
    "sent_by_email": "anna@stellaforce.com"
  }
  ```

  Every send mints a **new** HMAC-signed `state` with a fresh 7-day TTL
  (`STATE_TTL_SECONDS`, `src/lib/google-calendar/oauth.ts`), so clicking Resend
  is also how an expired link gets repaired.

- **n8n nodes:**
  1. **Webhook** — `POST`, path `calendar-connect-invite`, Authentication →
     **Header Auth** credential (`Authorization` = `Bearer <N8N_WEBHOOK_SECRET>`),
     Respond → *Using 'Respond to Webhook' node*.
  2. **Edit Fields (Set)** — normalize: `first_name` =
     `{{ $json.name.split(' ')[0] }}`, fallbacks for the nullable
     `role`/`job_title`/`client_name`/`sent_by_name`, `reason` default `added`.
  3. **Switch** — on `{{ $json.reason }}` → `added` / `resend` / `reconnect`,
     fallback output → `added`.
  4. **Edit Fields (Set) ×3** — one per branch, each emitting `subject` + `intro`:
     *added* → "Connect your calendar for {{job_title}}" / "You've been added as
     {{role}} on {{job_title}} at {{client_name}}."; *resend* → "Reminder:
     connect your calendar for {{job_title}}" / "A quick nudge — {{sent_by_name}}
     asked us to resend this."; *reconnect* → "Action needed: reconnect your
     calendar" / "Your Google Calendar connection stopped working, so we can't
     schedule interviews for you."
  5. **HTML** — one shared template: greet `first_name`, the branch `intro`, a
     CTA button to `{{ $json.connect_url }}`, footer noting the link expires
     `{{ $json.connect_url_expires_at }}` and that Google shows an
     "unverified app" warning during the pilot (expected — see
     `docs/google-calendar-consent-plan.md`).
  6. **Gmail** (or SMTP/SendGrid) — To `{{ $json.email }}`, Subject
     `{{ $json.subject }}`, HTML body from #5, **Reply-To
     `{{ $json.sent_by_email }}`**. Set *On Error → Continue (using error output)*.
  7. **Respond to Webhook ×2** — success `{ "ok": true }` / 200; the Gmail error
     output → `{ "ok": false, "error": … }` / 502. Respond **after** the send,
     not immediately: the app awaits the response, so the recruiter's Resend
     toast then reflects whether the mail actually went out.
  8. **Error Trigger** (separate workflow) — set as this workflow's
     *Settings → Error Workflow*.

- **Config:** the webhook URL is now the `serverEnv.n8nCalendarWebhookUrl`
  default and is also set in `.env.local`; `SITE_URL` is set to
  `http://localhost:3000` locally and must be set on Vercel too. Without
  `SITE_URL`, `serverEnv` throws, `sendCalendarConnectInvite` catches it, and
  every invite silently no-ops with a `not_configured` result.
- **Still blocking a real end-to-end test:** the Google OAuth client's
  registered redirect URI is `/api/auth/google/calendar/callback`, but the app
  serves the callback at `/api/calendar/oauth/callback` — consent will fail with
  `redirect_uri_mismatch` until `{SITE_URL}/api/calendar/oauth/callback` is
  registered in the Google Cloud Console.

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
| `job_team_members` | **W** by `addJobTeamMember`/`publishJob` (Server Actions, not n8n); R by 2,3,13 |
| `google_calendar_connections` | **W** by `/api/calendar/oauth/callback` (connect), `/api/calendar/token` + `getCalendarPreview` (revoke on an `invalid_grant` refresh failure); R by `/api/calendar/token`, `getJobTeamMembers` (derived connected/not-connected only), `getCalendarPreview` (`src/lib/server/calendar-events.ts` — mints an access token to read the Team panel's calendar preview). Service-role only table, no RLS policy for `authenticated` |
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
  `rejectCandidate`, `withdrawCandidate`, `publishJob`); `job_team_member_added`
  (from `addJobTeamMember`/`publishJob`); `calendar_connected` (from
  `/api/calendar/oauth/callback`) and `calendar_connection_revoked` (from
  `/api/calendar/token`) — these two are app-emitted even though they're
  triggered by Google/n8n, not a recruiter session.
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
