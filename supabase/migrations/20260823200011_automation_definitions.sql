-- The automation library: what a rule IS, versioned.
--
-- Split from where it applies (`automation_bindings`, next migration) so a job
-- override is a sparse row rather than a copy of the whole rule. That split is
-- the point of the whole design: without it, "pause this for one job" means
-- cloning a definition, and every later fix to the library becomes invisible to
-- every job that ever overrode anything.

-- ---------------------------------------------------------------------------
-- automation_definitions -- one stable logical automation.
-- ---------------------------------------------------------------------------
create table automation_definitions (
  id                 uuid primary key default gen_random_uuid(),

  -- The stable handle, e.g. 'interview_scheduled'. Deliberately NOT the same
  -- column as trigger_event_type: two rules may hang off one trigger (a VIP
  -- variant of candidate_added_to_stage), and keying on the trigger is exactly
  -- the collapse that `overrideByKey()` in src/lib/workflow-settings.ts does --
  -- it would silently drop the second rule.
  key                text not null,
  name               text not null,

  trigger_event_type activity_event_type not null,

  -- 'lifecycle' | 'scheduling' | 'evaluation'. Text, not an enum, following
  -- `workflow_settings.category`: it is a presentation grouping owned by
  -- src/lib/automation-sections.ts, which will grow (offers, sourcing) faster
  -- than anyone wants to write `alter type`.
  category           text not null,

  -- Integrity safeguards nobody may pause -- calendar final validation, slot
  -- locking, secure-link validation, audit behaviour. False on every seeded row
  -- today; the column ships now so the resolver and the write actions have a
  -- real axis to refuse on, and the first safeguard needs no migration.
  system_managed     boolean not null default false,

  -- Null = the Stellaforce-global library. Set = a definition bespoke to one
  -- customer. Here `client_id` means both tenant and owner, which is one
  -- meaning, so there is no double duty to split (unlike automation_bindings).
  client_id          uuid references clients(client_id) on delete cascade,

  -- Retire, never delete: bindings and (later) run records point at this row.
  archived_at        timestamptz,

  created_by         uuid references profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Two partial uniques rather than one `unique (client_id, key)`: NULLs never
-- collide in a plain unique, so the global library would happily accept two
-- rows with the same key.
create unique index automation_definitions_global_key_uniq
  on automation_definitions (key) where client_id is null;
create unique index automation_definitions_client_key_uniq
  on automation_definitions (client_id, key) where client_id is not null;

create index idx_automation_definitions_trigger  on automation_definitions (trigger_event_type);
create index idx_automation_definitions_client   on automation_definitions (client_id);
create index idx_automation_definitions_category on automation_definitions (category);

create trigger set_automation_definitions_updated_at
  before update on automation_definitions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- automation_definition_versions -- the immutable rule.
-- ---------------------------------------------------------------------------
create table automation_definition_versions (
  id            uuid primary key default gen_random_uuid(),
  definition_id uuid not null references automation_definitions(id) on delete cascade,

  -- Denormalised from the parent so the tenant RLS policy is the same two-line
  -- pair on every table and never needs an EXISTS in a hot path. Same rule as
  -- 20260728100500_wf_tenant_rls.sql.
  client_id     uuid references clients(client_id) on delete cascade,

  version       integer not null,
  status        automation_version_status not null default 'draft',

  -- The five facets the detail UI renders (src/components/automations/
  -- automation-rule-facets.tsx), as DESCRIPTIVE data only.
  --
  -- There is deliberately no machine-readable condition or action spec here.
  -- Nothing evaluates one in this pass, and an empty DSL column is an open
  -- invitation to the arbitrary user-authored conditions this pass rules out.
  -- The authored English sentence is the artifact; a predicate arrives in the
  -- pass that ships something able to read it.
  condition_text      text not null default '',
  actions             jsonb not null default '[]',  -- [{key,label}]
  tasks_and_reminders jsonb not null default '[]',  -- [{key,label}]
  exceptions          jsonb not null default '[]',  -- [{key,label}]

  -- Matches `sla_policies.sla_type` by value ('needs_scheduling' | ...). No FK
  -- is possible: that table holds scoped policy rows, not a vocabulary.
  sla_type      text,

  -- The authored approval posture. Descriptive -- it has no runtime effect
  -- until an executor exists, and it is NOT part of resolver output.
  default_mode  automation_mode not null default 'auto',

  notes         text,
  published_at  timestamptz,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (definition_id, version)
);

-- Exactly one published version per definition, so "what runs" is a lookup and
-- never a max(). Same shape as `resumes.is_current`.
create unique index automation_definition_versions_one_published
  on automation_definition_versions (definition_id) where status = 'published';

create index idx_automation_definition_versions_definition
  on automation_definition_versions (definition_id, status);
create index idx_automation_definition_versions_client
  on automation_definition_versions (client_id);

create trigger set_automation_definition_versions_updated_at
  before update on automation_definition_versions
  for each row execute function set_updated_at();
