-- ─────────────────────────────────────────────────────────────────────────────
-- V3.2 — Job Layer 1 (Evaluation Criteria / Scorecard / Team / Workflow
-- templates) and the two-tier pipeline model: fixed Tier-1 pipeline_stages
-- house variable per-job job_workflow_sub_stages ("Job stages" in the UI).
-- ─────────────────────────────────────────────────────────────────────────────

create table job_notes (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references job_orders(job_id) on delete cascade,
  content    text,
  file_path  text,
  created_at timestamptz not null default now()
);

create table job_competencies (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references job_orders(job_id) on delete cascade,
  type              competency_type not null,
  description       text not null,
  recommended_level fit_proficiency_level not null,
  skills            text[] not null default '{}',
  tools             text[] not null default '{}',
  created_at        timestamptz not null default now()
);

create table job_competency_level_descriptions (
  id            uuid primary key default gen_random_uuid(),
  competency_id uuid not null references job_competencies(id) on delete cascade,
  level         fit_proficiency_level not null,
  description   text not null,
  unique (competency_id, level)
);

create table job_scorecard_categories (
  id     uuid primary key default gen_random_uuid(),
  job_id uuid not null references job_orders(job_id) on delete cascade,
  name   text not null,
  weight numeric(5,2) not null
);

create table job_scorecard_category_competencies (
  category_id   uuid not null references job_scorecard_categories(id) on delete cascade,
  competency_id uuid not null references job_competencies(id) on delete cascade,
  primary key (category_id, competency_id),
  unique (competency_id)
);

create table job_team_members (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references job_orders(job_id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  name       text not null,
  email      text not null,
  role       text not null,
  created_at timestamptz not null default now()
);

create table pipeline_stages (
  id             uuid primary key default gen_random_uuid(),
  key            pipeline_stage unique not null,
  name           text not null,
  description    text,
  display_order  integer not null,
  color          text,
  sla_target_days integer,
  created_at     timestamptz not null default now()
);

insert into pipeline_stages (key, name, description, display_order) values
  ('source', 'Source', 'Identify and engage potential candidates', 0),
  ('screen', 'Screen', 'Confirm baseline qualifications and interest', 1),
  ('interview', 'Interview', 'Assess role-specific competencies', 2),
  ('offer', 'Offer', 'Extend and negotiate an offer', 3),
  ('close', 'Close', 'Candidate accepted and placement finalized', 4);

create table job_workflow_sub_stages (
  id                   uuid primary key default gen_random_uuid(),
  job_id               uuid not null references job_orders(job_id) on delete cascade,
  pipeline_stage_id    uuid not null references pipeline_stages(id) on delete restrict,
  name                 text not null,
  purpose              text,
  duration_minutes     integer,
  format               stage_format,
  questions            text,
  rating_scale         rating_scale,
  allowed_outcomes     text[] not null default '{}',
  needs_final_approval boolean not null default false,
  display_order        integer not null default 0,
  config               jsonb not null default '{}',
  created_at           timestamptz not null default now()
);

create table job_workflow_sub_stage_details (
  id            uuid primary key default gen_random_uuid(),
  sub_stage_id  uuid not null references job_workflow_sub_stages(id) on delete cascade,
  detail_type   text not null,
  label         text,
  content       text,
  file_path     text,
  metadata      jsonb not null default '{}',
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

create table job_workflow_sub_stage_competencies (
  sub_stage_id  uuid not null references job_workflow_sub_stages(id) on delete cascade,
  competency_id uuid not null references job_competencies(id) on delete cascade,
  primary key (sub_stage_id, competency_id)
);

create table job_workflow_sub_stage_reviewers (
  sub_stage_id uuid not null references job_workflow_sub_stages(id) on delete cascade,
  member_id    uuid not null references job_team_members(id) on delete cascade,
  primary key (sub_stage_id, member_id)
);
