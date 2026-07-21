-- ─────────────────────────────────────────────────────────────────────────────
-- V3.2 — Layer 2 (raw per-meeting evaluations), Layer 3 (computed scorecard),
-- Layer 4 (redeployment fit) tables.
-- ─────────────────────────────────────────────────────────────────────────────

create table application_stage_evaluations (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(application_id) on delete cascade,
  sub_stage_id   uuid not null references job_workflow_sub_stages(id) on delete cascade,
  status         eval_status not null default 'pending',
  interviewer_id uuid references job_team_members(id) on delete set null,
  interview_date timestamptz,
  mode           stage_format,
  rubric_score   numeric(3,1),
  summary        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table application_stage_evaluation_notes (
  id            uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references application_stage_evaluations(id) on delete cascade,
  note          text not null,
  display_order integer not null default 0
);

create table application_scorecard_categories (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(application_id) on delete cascade,
  category_id    uuid not null references job_scorecard_categories(id) on delete cascade,
  current_score  numeric(5,2),
  target_score   numeric(5,2),
  confidence     confidence_level,
  unique (application_id, category_id)
);

create table application_scorecard_competencies (
  id                     uuid primary key default gen_random_uuid(),
  scorecard_category_id  uuid not null references application_scorecard_categories(id) on delete cascade,
  competency_id          uuid not null references job_competencies(id) on delete cascade,
  achieved_proficiency   fit_proficiency_level not null,
  confidence             confidence_level not null,
  summary                text,
  data_provenance        data_provenance not null default 'ai_parsed',
  unique (scorecard_category_id, competency_id)
);

create table application_scorecard_evidence (
  id                      uuid primary key default gen_random_uuid(),
  scorecard_competency_id uuid not null references application_scorecard_competencies(id) on delete cascade,
  evaluation_id           uuid not null references application_stage_evaluations(id) on delete cascade,
  note                    text not null
);

-- candidate_client_fit already exists (0002_core_tables.sql) with 4 live rows;
-- these are purely additive.
alter table candidate_client_fit
  add column confidence confidence_level,
  add column data_provenance data_provenance not null default 'ai_parsed',
  add column last_evaluated_at timestamptz;

create table candidate_client_fit_evidence (
  id                      uuid primary key default gen_random_uuid(),
  fit_id                  uuid not null references candidate_client_fit(id) on delete cascade,
  scorecard_competency_id uuid not null references application_scorecard_competencies(id) on delete cascade,
  weight                  numeric(5,2)
);
