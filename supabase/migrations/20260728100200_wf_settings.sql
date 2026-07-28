-- ─────────────────────────────────────────────────────────────────────────────
-- Settings inheritance layer. Cross-cutting workflow settings resolve through
-- a cascade: global → client → workflow → job (most-specific wins). Global
-- rows are seeded defaults; workflows/jobs hold sparse overrides.
--
-- Singleton config categories live in workflow_settings (jsonb, deep-merged).
-- Collection categories (SLA / automation / communication) are their own
-- scoped tables so new options never force a rigid migration.
--
-- All four tables get tenant-scoped RLS (policies added in 20260728100500).
-- ─────────────────────────────────────────────────────────────────────────────

create table workflow_settings (
  id         uuid primary key default gen_random_uuid(),
  scope      settings_scope not null,
  scope_id   uuid,                       -- null when scope = 'global'
  category   text not null,              -- 'scheduling' | 'ai_capabilities' | …
  config     jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, scope_id, category)
);

create table sla_policies (
  id             uuid primary key default gen_random_uuid(),
  scope          settings_scope not null,
  scope_id       uuid,
  sla_type       text not null,          -- 'needs_scheduling' | 'needs_feedback' | …
  threshold_hours integer,
  enabled        boolean not null default true,
  config         jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (scope, scope_id, sla_type)
);

create table automation_rules (
  id                 uuid primary key default gen_random_uuid(),
  scope              settings_scope not null,
  scope_id           uuid,
  trigger_event_type activity_event_type not null,
  conditions         jsonb not null default '{}',
  actions            jsonb not null default '[]',
  enabled            boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table communication_templates (
  id                 uuid primary key default gen_random_uuid(),
  scope              settings_scope not null,
  scope_id           uuid,
  trigger_event_type activity_event_type not null,
  channel            text not null default 'email',
  subject            text,
  body               text,
  recipients         jsonb not null default '[]',
  enabled            boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── Indexes (scope lookups drive resolution)
create index idx_workflow_settings_scope on workflow_settings(scope, scope_id);
create index idx_sla_policies_scope on sla_policies(scope, scope_id);
create index idx_automation_rules_scope on automation_rules(scope, scope_id);
create index idx_automation_rules_trigger on automation_rules(trigger_event_type);
create index idx_communication_templates_scope on communication_templates(scope, scope_id);
create index idx_communication_templates_trigger on communication_templates(trigger_event_type);

-- ── updated_at triggers
create trigger set_workflow_settings_updated_at before update on workflow_settings
  for each row execute function set_updated_at();
create trigger set_sla_policies_updated_at before update on sla_policies
  for each row execute function set_updated_at();
create trigger set_automation_rules_updated_at before update on automation_rules
  for each row execute function set_updated_at();
create trigger set_communication_templates_updated_at before update on communication_templates
  for each row execute function set_updated_at();

-- ── Enable RLS (tenant-scoped policies added in 20260728100500)
alter table workflow_settings enable row level security;
alter table sla_policies enable row level security;
alter table automation_rules enable row level security;
alter table communication_templates enable row level security;

-- ── Seed global-scope defaults so every workflow inherits working settings.
insert into workflow_settings (scope, scope_id, category, config) values
  ('global', null, 'scheduling',     '{"scheduling_policy": "candidate_self_scheduling", "rescheduling_policy": "recruiter_approval"}'),
  ('global', null, 'ai_capabilities', '{"suggest_questions": true, "summarize_interviews": true}');

insert into sla_policies (scope, scope_id, sla_type, threshold_hours, enabled) values
  ('global', null, 'needs_scheduling',       48, true),
  ('global', null, 'needs_feedback',         24, true),
  ('global', null, 'needs_decision',         48, true),
  ('global', null, 'needs_offer_creation',   24, true),
  ('global', null, 'offer_needs_to_be_sent', 24, true),
  ('global', null, 'offer_sent',            120, true),
  ('global', null, 'needs_attention',        72, true);

insert into communication_templates (scope, scope_id, trigger_event_type, channel, subject, body, recipients) values
  ('global', null, 'interview_scheduled',    'email', 'Your interview is scheduled', 'Hi {{candidate_first_name}}, your {{stage_name}} interview is scheduled for {{scheduled_at}}.', '["candidate","interviewer"]'),
  ('global', null, 'interview_reminder_sent', 'email', 'Interview reminder & prep', 'Reminder: {{stage_name}} with {{candidate_full_name}} at {{scheduled_at}}. Focus areas: {{focus_areas}}.', '["interviewer","candidate"]'),
  ('global', null, 'scorecard_link_sent',    'email', 'Submit your scorecard', 'Please submit your scorecard for {{candidate_full_name}}: {{secure_link}}', '["reviewer"]'),
  ('global', null, 'evaluation_overdue',     'email', 'Scorecard overdue', 'Your scorecard for {{candidate_full_name}} is overdue by {{hours_overdue}}h: {{secure_link}}', '["reviewer","recruiter"]'),
  ('global', null, 'stage_sla_breached',     'email', 'Candidate stuck in stage', '{{candidate_full_name}} has been in {{stage_name}} for {{days_in_stage}} days (SLA {{sla_target}}).', '["owner","hr_manager"]');
