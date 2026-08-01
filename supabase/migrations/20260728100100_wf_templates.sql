-- ─────────────────────────────────────────────────────────────────────────────
-- Workflow templates (reusable pipelines) + their Tier-2 sub-stages.
--
-- A template is Stellaforce-global (client_id null) or client-owned. On job
-- publish, workflow_template_sub_stages are SNAPSHOTTED into the per-job
-- job_workflow_sub_stages, so later template edits never touch live jobs.
-- workflow_templates gets tenant-scoped RLS (see 20260728100500); the
-- sub-stage table keeps the permissive authenticated policy.
-- ─────────────────────────────────────────────────────────────────────────────

create table workflow_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  department  text,
  hiring_type employment_type,
  status      workflow_template_status not null default 'draft',
  client_id   uuid references clients(client_id) on delete cascade,  -- null = Stellaforce-global
  created_by  uuid references profiles(id) on delete set null,
  version     integer not null default 1,
  config      jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table workflow_template_sub_stages (
  id                        uuid primary key default gen_random_uuid(),
  template_id               uuid not null references workflow_templates(id) on delete cascade,
  pipeline_stage_id         uuid not null references pipeline_stages(id) on delete restrict,
  name                      text not null,
  purpose                   text,
  duration_minutes          integer,
  format                    stage_format,
  visibility                stage_visibility not null default 'internal',
  owner_role                text,
  collaborator_role         text,
  entry_conditions          stage_entry_condition[] not null default '{automatic,manual}',
  interviewer_type          interviewer_type not null default 'human',
  question_source           question_source,
  required_questions        text,
  capture_feedback_form     boolean not null default true,
  capture_transcript        boolean not null default true,
  decision_mode             decision_mode not null default 'single_rater',
  decision_owner            text,
  rating_scale              rating_scale,                    -- stage decision scale (screen/interview)
  hire_recommendation_enabled boolean not null default false, -- true on the final offer stage
  override_enabled          boolean not null default false,
  override_roles            text,
  allowed_outcomes          text[] not null default '{}',
  needs_final_approval      boolean not null default false,
  display_order             integer not null default 0,
  config                    jsonb not null default '{}',
  created_at                timestamptz not null default now()
);

-- ── Snapshot targets: give the per-job sub-stage table the same promoted
--    columns so publishJob can copy a template sub-stage losslessly.
alter table job_workflow_sub_stages
  add column visibility                  stage_visibility not null default 'internal',
  add column owner_role                  text,
  add column collaborator_role           text,
  add column entry_conditions            stage_entry_condition[] not null default '{automatic,manual}',
  add column interviewer_type            interviewer_type not null default 'human',
  add column question_source             question_source,
  add column required_questions          text,
  add column capture_feedback_form       boolean not null default true,
  add column capture_transcript          boolean not null default true,
  add column decision_mode               decision_mode not null default 'single_rater',
  add column decision_owner              text,
  add column hire_recommendation_enabled boolean not null default false,
  add column override_enabled            boolean not null default false,
  add column override_roles              text;

-- ── Job → template provenance
alter table job_orders
  add column workflow_template_id      uuid references workflow_templates(id) on delete set null,
  add column workflow_template_version integer;

-- ── Indexes
create index idx_workflow_templates_client on workflow_templates(client_id);
create index idx_workflow_templates_created_by on workflow_templates(created_by);
create index idx_wf_template_sub_stages_template on workflow_template_sub_stages(template_id);
create index idx_wf_template_sub_stages_pipeline_stage on workflow_template_sub_stages(pipeline_stage_id);
create index idx_job_orders_workflow_template on job_orders(workflow_template_id);

-- ── updated_at trigger (reuse the existing set_updated_at function)
create trigger set_workflow_templates_updated_at
  before update on workflow_templates
  for each row execute function set_updated_at();

-- ── RLS: sub-stage table permissive (structural); workflow_templates policy
--    is defined in the tenant-scoped RLS migration (20260728100500).
alter table workflow_templates enable row level security;
alter table workflow_template_sub_stages enable row level security;

create policy "recruiters_all_workflow_template_sub_stages" on workflow_template_sub_stages
  for all to authenticated using (true) with check (true);
