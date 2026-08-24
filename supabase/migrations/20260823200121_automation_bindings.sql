-- `automation_rules` becomes `automation_bindings`.
--
-- The old table mashed together what a rule IS (conditions, actions) and where
-- it APPLIES (scope, scope_id). Splitting those is the whole design: the rule
-- lives in automation_definition_versions, and a row here is a sparse override
-- saying only "at this scope, this rule's state is X".
--
-- The table has never held a row and has exactly one reader
-- (src/lib/workflow-settings.ts), so the rename is free.

-- Every `add column ... not null` below is only legal because the table is
-- empty. Fail loudly rather than half-migrate.
do $$ begin
  if (select count(*) from public.automation_rules) > 0 then
    raise exception 'automation_rules is not empty -- backfill automation_definition_id first';
  end if;
end $$;

alter table automation_rules rename to automation_bindings;

-- None of these follow the table automatically.
alter table automation_bindings rename constraint automation_rules_pkey
  to automation_bindings_pkey;
alter table automation_bindings rename constraint automation_rules_client_id_fkey
  to automation_bindings_tenant_client_id_fkey;
alter trigger set_automation_rules_updated_at on automation_bindings
  rename to set_automation_bindings_updated_at;
alter policy "tenant_read_automation_rules"  on automation_bindings
  rename to "tenant_read_automation_bindings";
alter policy "tenant_write_automation_rules" on automation_bindings
  rename to "tenant_write_automation_bindings";
alter index idx_automation_rules_client rename to idx_automation_bindings_tenant;

-- ---------------------------------------------------------------------------
-- What moves out.
-- ---------------------------------------------------------------------------
alter table automation_bindings
  drop column conditions,           -- -> automation_definition_versions
  drop column actions,              -- -> automation_definition_versions
  drop column enabled,              -- -> state, which has three values not two
  -- A denormalised copy of the definition's trigger that could disagree with
  -- its parent. One join replaces it.
  drop column trigger_event_type,
  -- Replaced below by typed FKs and a generated `scope`. Dropping these also
  -- drops idx_automation_rules_scope and idx_automation_rules_trigger.
  drop column scope,
  drop column scope_id;

-- ---------------------------------------------------------------------------
-- Tenant ownership and company scope are two different questions.
--
-- On the old table one `client_id` answered both, which meant
-- `where client_id is not null` looked like "company-scoped" but was actually
-- true of every job and company row alike. Splitting the column removes the
-- footgun rather than documenting it.
-- ---------------------------------------------------------------------------
alter table automation_bindings rename column client_id to tenant_client_id;

comment on column automation_bindings.tenant_client_id is
  'WHO OWNS THIS ROW. The RLS partition key -- null only for global-library rows '
  '(and for bindings on a Stellaforce-global workflow template). Never use this '
  'to detect company scope; read the generated `scope` column.';

alter table automation_bindings
  add column automation_definition_id uuid not null
    references automation_definitions(id) on delete cascade,

  -- Not nullable: a binding that overrides nothing must not exist. A scope with
  -- nothing to say stores no row at all, which is the same rule
  -- `pruneStoredPolicy` follows in src/lib/policy-settings.ts -- and it is what
  -- makes "reset to inherited" a DELETE rather than a row full of nulls.
  add column state automation_state not null,

  add column set_by uuid references profiles(id) on delete set null,
  add column note   text,

  -- WHAT THIS ROW TARGETS. Exactly one of the three is set, or none for global.
  add column company_scope_client_id uuid references clients(client_id)  on delete cascade,
  add column workflow_template_id    uuid references workflow_templates(id) on delete cascade,
  add column job_id                  uuid references job_orders(job_id)  on delete cascade;

comment on column automation_bindings.company_scope_client_id is
  'WHAT THIS ROW TARGETS at company scope. Non-null only for company-scoped '
  'bindings, and always equal to tenant_client_id when set.';

-- Typed FKs rather than the (scope, scope_id) pattern the sibling settings
-- tables use. There, a generic column was the only option -- four scopes whose
-- ids live in four tables. Here the parents are enumerable, and the payoff is
-- sharper than it would be for settings: an orphaned `workflow_settings` row is
-- inert bloat, but an orphaned binding is state the resolver reads AND the
-- provenance UI renders -- telling someone a rule is "Job override" on a job
-- that no longer exists. Cascade deletes now come for free, where deleteJob()
-- currently hand-deletes activity_events to achieve the same thing.
alter table automation_bindings
  add column scope settings_scope not null generated always as (
    case when job_id                  is not null then 'job'::settings_scope
         when workflow_template_id    is not null then 'workflow'::settings_scope
         when company_scope_client_id is not null then 'client'::settings_scope
         else 'global'::settings_scope end
  ) stored;

comment on column automation_bindings.scope is
  'Derived from which target column is set, so it cannot disagree with them. '
  'This is the ONLY correct way to ask what scope a binding applies at.';

-- ---------------------------------------------------------------------------
-- Constraints. Written against the base columns rather than `scope` so they
-- hold regardless of how the generated expression is defined.
-- ---------------------------------------------------------------------------
alter table automation_bindings
  add constraint automation_bindings_one_scope
    check (num_nonnulls(company_scope_client_id, workflow_template_id, job_id) <= 1),

  -- A job binding is always tenant-filterable (job_orders.client_id is NOT NULL).
  add constraint automation_bindings_job_has_tenant
    check (job_id is null or tenant_client_id is not null),

  -- At company scope the two columns describe the same customer; letting them
  -- diverge would mean a row owned by one tenant configuring another.
  add constraint automation_bindings_company_tenant_matches
    check (company_scope_client_id is null
           or tenant_client_id = company_scope_client_id),

  -- A global-library row targets nobody and is owned by nobody.
  add constraint automation_bindings_global_has_no_tenant
    check (num_nonnulls(company_scope_client_id, workflow_template_id, job_id) > 0
           or tenant_client_id is null);

-- ---------------------------------------------------------------------------
-- The unique constraint `automation_rules` never had. Four partials, because
-- NULLs never collide in a plain unique -- this is what makes "one binding per
-- definition per target scope" true rather than merely intended, and what lets
-- the write path be a safe read-then-insert-or-update.
-- ---------------------------------------------------------------------------
create unique index automation_bindings_global_uniq
  on automation_bindings (automation_definition_id)
  where company_scope_client_id is null and workflow_template_id is null and job_id is null;
create unique index automation_bindings_company_uniq
  on automation_bindings (automation_definition_id, company_scope_client_id)
  where company_scope_client_id is not null;
create unique index automation_bindings_workflow_uniq
  on automation_bindings (automation_definition_id, workflow_template_id)
  where workflow_template_id is not null;
create unique index automation_bindings_job_uniq
  on automation_bindings (automation_definition_id, job_id)
  where job_id is not null;

create index idx_automation_bindings_scope      on automation_bindings (scope);
create index idx_automation_bindings_definition on automation_bindings (automation_definition_id);
create index idx_automation_bindings_job        on automation_bindings (job_id);
create index idx_automation_bindings_template   on automation_bindings (workflow_template_id);
create index idx_automation_bindings_company    on automation_bindings (company_scope_client_id);
