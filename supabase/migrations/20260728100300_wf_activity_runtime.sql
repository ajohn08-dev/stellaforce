-- ─────────────────────────────────────────────────────────────────────────────
-- Candidate-movement runtime + unified activity log + compliance primitives.
--
-- activity_events: append-only unified log AND transactional outbox. Captures
-- the 31 V3 lifecycle events plus candidate/job activity. Denormalized
-- client_id/candidate_id/job_id make per-tenant/per-candidate/per-job
-- timelines single-query (and let tenant RLS filter without a join).
--
-- Tenant-scoped RLS (activity_events, audit_log, ai_interactions) is applied in
-- 20260728100500; application_stage_history keeps the permissive policy.
-- ─────────────────────────────────────────────────────────────────────────────

create table activity_events (
  id                uuid primary key default gen_random_uuid(),
  event_type        activity_event_type not null,
  client_id         uuid references clients(client_id) on delete set null,
  candidate_id      uuid references candidates(candidate_id) on delete set null,
  job_id            uuid references job_orders(job_id) on delete set null,
  application_id    uuid references applications(application_id) on delete set null,
  sub_stage_id      uuid references job_workflow_sub_stages(id) on delete set null,
  actor_type        actor_type not null default 'user',
  actor_profile_id  uuid references profiles(id) on delete set null,
  system_source     text,
  severity          event_severity not null default 'info',
  payload           jsonb not null default '{}',
  reverses_event_id uuid references activity_events(id) on delete set null,
  idempotency_key   text unique,
  dispatched_at     timestamptz,
  created_at        timestamptz not null default now(),
  constraint activity_events_scope_present
    check (candidate_id is not null or job_id is not null or application_id is not null)
);

create table application_stage_history (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(application_id) on delete cascade,
  sub_stage_id   uuid not null references job_workflow_sub_stages(id) on delete cascade,
  entered_at     timestamptz not null default now(),
  exited_at      timestamptz,
  outcome        text,               -- advance | reject | skipped | withdraw
  sla_breached   boolean not null default false,
  decided_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

alter table applications
  add column owner_profile_id uuid references profiles(id) on delete set null;

-- ── Config-governance audit trail (who changed a template / settings)
create table audit_log (
  id               uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references profiles(id) on delete set null,
  client_id        uuid references clients(client_id) on delete set null,
  entity_type      text not null,     -- 'workflow_template' | 'workflow_settings' | …
  entity_id        uuid,
  action           text not null,
  diff             jsonb not null default '{}',
  created_at       timestamptz not null default now()
);

-- ── AI telemetry + legal activity log (EU AI Act high-risk, retain >=6mo)
create table ai_interactions (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid references clients(client_id) on delete set null,
  application_id uuid references applications(application_id) on delete set null,
  candidate_id   uuid references candidates(candidate_id) on delete set null,
  sub_stage_id   uuid references job_workflow_sub_stages(id) on delete set null,
  capability     text not null,       -- 'suggest_questions' | 'summarize' | 'voice_interview' | 'score'
  model          text,
  prompt_version text,
  input_ref      jsonb not null default '{}',
  output_ref     jsonb not null default '{}',
  tokens         integer,
  latency_ms     integer,
  confidence     numeric,
  created_at     timestamptz not null default now()
);

-- ── Indexes
create index idx_activity_events_client on activity_events(client_id);
create index idx_activity_events_candidate on activity_events(candidate_id);
create index idx_activity_events_job on activity_events(job_id);
create index idx_activity_events_application on activity_events(application_id);
create index idx_activity_events_type on activity_events(event_type);
create index idx_activity_events_created on activity_events(created_at);
create index idx_activity_events_undispatched on activity_events(dispatched_at) where dispatched_at is null;

create index idx_app_stage_history_application on application_stage_history(application_id);
create index idx_app_stage_history_sub_stage on application_stage_history(sub_stage_id);
create index idx_applications_owner on applications(owner_profile_id);

create index idx_audit_log_client on audit_log(client_id);
create index idx_audit_log_entity on audit_log(entity_type, entity_id);

create index idx_ai_interactions_client on ai_interactions(client_id);
create index idx_ai_interactions_application on ai_interactions(application_id);
create index idx_ai_interactions_candidate on ai_interactions(candidate_id);

-- ── RLS: application_stage_history permissive; the sensitive tables enable RLS
--    here and get tenant-scoped policies in 20260728100500.
alter table activity_events enable row level security;
alter table application_stage_history enable row level security;
alter table audit_log enable row level security;
alter table ai_interactions enable row level security;

create policy "recruiters_all_application_stage_history" on application_stage_history
  for all to authenticated using (true) with check (true);
