set local search_path = public, extensions;

-- ── Agent capacity ──────────────────────────────────────────────────────────
-- Capacity is a property of the AGENT, not of a stage: the voice provider
-- refuses the N+1th concurrent conversation regardless of which stage asked.
-- Two stages sharing one agent would each claim the stage's number and together
-- sum past the real limit, so a per-stage `agent_concurrency` is only ever a
-- REDUCTION of this — least(stage, agent) at snapshot time.
--
-- ⚠️ `agents` has no client_id, so this ceiling is a GLOBAL pool shared across
-- every tenant: a busy client can starve another. Accepted for this pass and
-- flagged; the fix needs a tenant column on `agents`, which is its own decision.
alter table public.agents
  add column max_concurrent_calls smallint not null default 3
    check (max_concurrent_calls between 1 and 50);

-- ═══════════════════════════════════════════════════════════════════════════
-- interview_scheduling_requests — one booking-link attempt.
-- ═══════════════════════════════════════════════════════════════════════════
create table public.interview_scheduling_requests (
  id             uuid primary key default gen_random_uuid(),

  application_id uuid not null references public.applications(application_id) on delete cascade,
  sub_stage_id   uuid not null references public.job_workflow_sub_stages(id)  on delete cascade,
  -- Denormalized exactly as activity_events and call_recordings do, so the
  -- recruiter-facing view filters by tenant with no join.
  client_id      uuid not null references public.clients(client_id)           on delete cascade,
  candidate_id   uuid not null references public.candidates(candidate_id)     on delete cascade,
  job_id         uuid not null references public.job_orders(job_id)           on delete cascade,
  agent_id       uuid not null references public.agents(id)                   on delete restrict,

  status         scheduling_request_status not null default 'pending',

  -- ── The token ──────────────────────────────────────────────────────────────
  -- 32 random bytes, base64url, in the URL only. Only sha256(token) hex is
  -- stored; the token itself is never persisted anywhere.
  --
  -- Singular columns rather than a child table: there is one active link per
  -- request by design, a re-issue overwrites, and the history of issuance lives
  -- in activity_events (`booking_link_sent`) where it belongs. A child table
  -- would buy a history nobody queries at the cost of a join on the hottest
  -- public path in the app.
  token_hash       text not null,
  token_issued_at  timestamptz not null default now(),
  token_expires_at timestamptz not null,

  -- ── Config snapshot, resolved once at creation ────────────────────────────
  -- Frozen deliberately. A recruiter editing the stage's minimum notice while a
  -- candidate has the booking page open must not invalidate their live hold or
  -- silently move the slot grid under them. Same reasoning as publishJob
  -- snapshotting the workflow template.
  slot_minutes             smallint not null check (slot_minutes between 5 and 480),
  slot_granularity_minutes smallint not null check (slot_granularity_minutes between 5 and 120),
  minimum_notice_minutes   integer  not null check (minimum_notice_minutes >= 0),
  booking_horizon_days     smallint not null check (booking_horizon_days between 1 and 90),
  hold_seconds             integer  not null default 300 check (hold_seconds between 30 and 3600),
  allow_start_now          boolean  not null default true,
  agent_concurrency_limit  smallint not null check (agent_concurrency_limit >= 1),

  -- Operating hours, in operating_timezone's WALL CLOCK. `candidates.timezone`
  -- is the only timezone column that existed anywhere in the schema, so a
  -- job/company operating zone is introduced here.
  operating_timezone   text       not null default 'America/Los_Angeles',
  operating_start_hour smallint   not null default 9  check (operating_start_hour between 0 and 23),
  operating_end_hour   smallint   not null default 17 check (operating_end_hour  between 1 and 24),
  operating_days       smallint[] not null default '{1,2,3,4,5}',

  -- ── Outcome ────────────────────────────────────────────────────────────────
  interview_id        uuid,   -- FK added below, once `interviews` exists
  booked_at           timestamptz,
  candidate_timezone  text,   -- what the candidate actually picked
  failure_reason_code text,
  -- The alert activity_events row, so a later resolution event can point back.
  failure_event_id    uuid references public.activity_events(id) on delete set null,

  dispatched_to_n8n_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint isr_hours_ordered check (operating_end_hour > operating_start_hour),
  constraint isr_booked_has_interview
    check (status <> 'booked' or (interview_id is not null and booked_at is not null)),
  constraint isr_failed_has_reason
    check (status <> 'failed' or failure_reason_code is not null)
);

-- The public route's only lookup. Unique so a hash collision, or a bug that
-- reuses a token, is a write error rather than a silent cross-candidate leak.
create unique index interview_scheduling_requests_token_hash_key
  on public.interview_scheduling_requests (token_hash);

-- At most ONE live request per (application, sub_stage). This is what stops a
-- double-fired stage entry emailing two links — a constraint rather than a
-- check-then-insert, because the trigger can race with itself.
create unique index interview_scheduling_requests_one_live
  on public.interview_scheduling_requests (application_id, sub_stage_id)
  where status in ('pending', 'sent');

create index idx_isr_application on public.interview_scheduling_requests (application_id);
create index idx_isr_client      on public.interview_scheduling_requests (client_id);
create index idx_isr_candidate   on public.interview_scheduling_requests (candidate_id);
create index idx_isr_job         on public.interview_scheduling_requests (job_id);
create index idx_isr_sub_stage   on public.interview_scheduling_requests (sub_stage_id);
create index idx_isr_agent       on public.interview_scheduling_requests (agent_id);
create index idx_isr_created_by  on public.interview_scheduling_requests (created_by);
create index idx_isr_failure_evt on public.interview_scheduling_requests (failure_event_id);
-- Drives the expiry sweeper.
create index idx_isr_expiring    on public.interview_scheduling_requests (token_expires_at)
  where status in ('pending', 'sent');

create trigger set_interview_scheduling_requests_updated_at
  before update on public.interview_scheduling_requests
  for each row execute function set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- interviews — the booking of record.
-- ═══════════════════════════════════════════════════════════════════════════
create table public.interviews (
  id             uuid primary key default gen_random_uuid(),

  application_id uuid not null references public.applications(application_id) on delete cascade,
  sub_stage_id   uuid not null references public.job_workflow_sub_stages(id)  on delete restrict,
  client_id      uuid not null references public.clients(client_id)           on delete cascade,
  candidate_id   uuid not null references public.candidates(candidate_id)     on delete cascade,
  job_id         uuid not null references public.job_orders(job_id)           on delete cascade,

  scheduling_request_id uuid references public.interview_scheduling_requests(id) on delete set null,

  status           interview_status not null default 'scheduled',
  interviewer_type interviewer_type not null default 'ai',
  agent_id         uuid references public.agents(id) on delete restrict,
  format           stage_format,

  scheduled_at timestamptz not null,
  ends_at      timestamptz not null,
  -- Absolute instants, so DST is purely a rendering concern. Half-open, so a
  -- 10:00–10:30 and a 10:30–11:00 booking do NOT collide.
  during tstzrange generated always as (tstzrange(scheduled_at, ends_at, '[)')) stored,

  -- Which of the agent's N concurrency lanes this booking occupies. A
  -- bookkeeping device that turns "capacity N" into something an exclusion
  -- constraint — which can only ever express capacity 1 — is able to police.
  agent_slot_index smallint not null default 0 check (agent_slot_index >= 0),

  candidate_timezone text,
  started_now        boolean not null default false,

  canceled_at   timestamptz,
  cancel_reason text,
  completed_at  timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint interviews_time_ordered check (ends_at > scheduled_at),
  constraint interviews_ai_needs_agent
    check (interviewer_type <> 'ai' or agent_id is not null),
  constraint interviews_canceled_has_timestamp
    check (status <> 'canceled' or canceled_at is not null),

  -- The invariant, not the mechanism. confirm_interview_booking() already
  -- guarantees this under an advisory lock; this catches any OTHER write path —
  -- a future recruiter-led booking, a backfill, a bug in the lane arithmetic —
  -- rather than letting it double-book silently.
  constraint interviews_no_agent_lane_overlap
    exclude using gist (
      agent_id         with =,
      agent_slot_index with =,
      during           with &&
    ) where (agent_id is not null and status in ('scheduled', 'in_progress'))
);

alter table public.interview_scheduling_requests
  add constraint interview_scheduling_requests_interview_fk
  foreign key (interview_id) references public.interviews(id) on delete set null;

create index idx_interviews_application on public.interviews (application_id);
create index idx_interviews_sub_stage   on public.interviews (sub_stage_id);
create index idx_interviews_client      on public.interviews (client_id);
create index idx_interviews_candidate   on public.interviews (candidate_id);
create index idx_interviews_job         on public.interviews (job_id);
create index idx_interviews_request     on public.interviews (scheduling_request_id);
-- "What is coming up for this agent" — the availability query.
create index idx_interviews_agent_window on public.interviews (agent_id, scheduled_at)
  where status in ('scheduled', 'in_progress');

create trigger set_interviews_updated_at
  before update on public.interviews
  for each row execute function set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- interview_slot_holds — a TTL'd lease, NOT a booking.
--
-- Separate from `interviews` for three reasons, any one sufficient:
--   1. A hold must STOP EXISTING on a clock, with nothing on the critical path.
--      An interviews row with status='held' never stops existing — it needs a
--      sweeper, and until that runs it is indistinguishable from a real
--      interview to every reader. One forgotten `and status <> 'held'` and a
--      recruiter sees an interview that was never booked.
--   2. interviews.id is referenced by three tables. Holds are high-churn
--      garbage — one per click, most abandoned — and mixing a permanent,
--      referenced record with a table whose modal row lives 90 seconds is a
--      vacuum problem as much as a modelling one.
--   3. `interview_scheduled` must be emitted exactly once, on INSERT. If holds
--      were interviews the emit site would be a status-transition UPDATE, which
--      is strictly harder to make idempotent — and this codebase's entire
--      idempotency story is a unique key on insert.
-- ═══════════════════════════════════════════════════════════════════════════
create table public.interview_slot_holds (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.interview_scheduling_requests(id) on delete cascade,
  agent_id   uuid not null references public.agents(id) on delete cascade,

  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  during    tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  agent_slot_index smallint not null check (agent_slot_index >= 0),

  expires_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint holds_time_ordered check (ends_at > starts_at),

  -- Same belt-and-braces as `interviews`. Note the predicate CANNOT reference
  -- now() — it isn't immutable — so an expired hold still occupies its lane at
  -- the index level. That is why every writer deletes expired holds for the
  -- agent as its first act under the advisory lock: the table is self-cleaning,
  -- and the cron sweep is only a backstop for agents nobody is booking.
  constraint holds_no_agent_lane_overlap
    exclude using gist (
      agent_id         with =,
      agent_slot_index with =,
      during           with &&
    )
);

-- One live hold per request. A candidate clicking three slots in a row must
-- MOVE their hold, not accumulate three — otherwise one browsing candidate can
-- consume an agent's entire capacity.
create unique index interview_slot_holds_one_per_request
  on public.interview_slot_holds (request_id);

create index idx_holds_agent_expiry on public.interview_slot_holds (agent_id, expires_at);
create index idx_holds_expiry       on public.interview_slot_holds (expires_at);

-- No updated_at column and no trigger: a hold is created, then either consumed
-- or deleted. It is never edited.

-- ═══════════════════════════════════════════════════════════════════════════
-- scheduled_agent_calls — the durable outbound queue.
--
-- Named for exactly one job so it cannot quietly become the generic executor
-- this pass rules out.
-- ═══════════════════════════════════════════════════════════════════════════
create table public.scheduled_agent_calls (
  id           uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  agent_id     uuid not null references public.agents(id)     on delete restrict,
  -- Denormalized for the dispatcher, which must not join five tables per tick.
  application_id uuid not null references public.applications(application_id) on delete cascade,
  client_id      uuid not null references public.clients(client_id)           on delete cascade,
  candidate_id   uuid not null references public.candidates(candidate_id)     on delete cascade,
  job_id         uuid not null references public.job_orders(job_id)           on delete cascade,
  sub_stage_id   uuid not null references public.job_workflow_sub_stages(id)  on delete cascade,

  status scheduled_call_status not null default 'pending',
  -- When to hand this to n8n. Start-now sets now(); a future booking sets
  -- scheduled_at minus a small lead, so provider spin-up lands the call ON the
  -- slot rather than after it.
  run_at timestamptz not null,

  attempts     smallint not null default 0,
  max_attempts smallint not null default 5,
  -- Held by the claimer. A dispatcher that dies mid-flight leaves a `claimed`
  -- row that becomes claimable again when this passes — crash recovery with no
  -- reaper process.
  locked_until    timestamptz,
  last_attempt_at timestamptz,
  last_error      text,
  dispatched_at   timestamptz,
  canceled_at     timestamptz,
  suppressed_reason text,

  -- Stable across every retry of this logical call, so n8n and the voice
  -- provider can dedupe. A retry after a socket timeout must not double-dial a
  -- real person.
  campaign_id uuid not null default gen_random_uuid(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sac_attempts_bounded check (attempts <= max_attempts)
);

-- At most one live call per interview. A reschedule cancels the old row before
-- inserting a new one; this makes forgetting that a write error.
create unique index scheduled_agent_calls_one_live
  on public.scheduled_agent_calls (interview_id)
  where status in ('pending', 'claimed');

-- The claim query's index.
create index idx_sac_due on public.scheduled_agent_calls (run_at)
  where status = 'pending';
create index idx_sac_interview   on public.scheduled_agent_calls (interview_id);
create index idx_sac_agent       on public.scheduled_agent_calls (agent_id);
create index idx_sac_client      on public.scheduled_agent_calls (client_id);
create index idx_sac_application on public.scheduled_agent_calls (application_id);
create index idx_sac_candidate   on public.scheduled_agent_calls (candidate_id);
create index idx_sac_job         on public.scheduled_agent_calls (job_id);
create index idx_sac_sub_stage   on public.scheduled_agent_calls (sub_stage_id);

create trigger set_scheduled_agent_calls_updated_at
  before update on public.scheduled_agent_calls
  for each row execute function set_updated_at();
