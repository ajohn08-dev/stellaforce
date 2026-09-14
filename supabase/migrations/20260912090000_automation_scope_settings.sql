-- An account-wide automation switch.
--
-- `automation_bindings` answers "at this scope, what is the state of THIS rule".
-- This table answers a different question: "at this scope, is the account
-- running automations at all". That is a third thing, not a special case of the
-- second -- which is why it is not modelled as a binding with a null
-- automation_definition_id. A nullable FK carrying semantic weight is exactly
-- the tenant_client_id/company_scope_client_id ambiguity the previous migration
-- warns about, and the split here is the same one that separated a rule from
-- its scope in the first place.
--
-- Every column that decides scope is copied verbatim from automation_bindings,
-- so src/lib/automation-resolve.ts walks ONE chain for both tables rather than
-- growing a second, subtly different one.

create table public.automation_scope_settings (
  id uuid primary key default gen_random_uuid(),

  -- The existing three-value enum, reused deliberately rather than a boolean or
  -- a new mode vocabulary. `paused` (a hiring manager is away, an incident is
  -- open) and `off` (this account does not use automation) are different facts
  -- with different expected lifetimes, and the library already says so.
  state public.automation_state not null,

  -- null = every category. Otherwise an automation_definitions.category value
  -- ('lifecycle' | 'scheduling' | 'evaluation'), so candidate-facing scheduling
  -- can stop while internal evaluation tasks keep running. Not an FK: category
  -- is a text column on automation_definitions, not a lookup table.
  category text,

  -- Paused-until. A switch flipped during an incident and never flipped back is
  -- the classic failure of this feature, so a pause may carry its own end.
  -- The RESOLVER honours this, not a cron -- see the check script.
  resume_at timestamptz,

  reason text,
  set_by uuid references public.profiles(id) on delete set null,

  -- WHO OWNS THIS ROW -- the RLS partition key. Null only for the global default.
  -- Never use it to detect company scope; read the generated `scope` column.
  tenant_client_id uuid references public.clients(client_id) on delete cascade,

  -- WHAT THIS ROW TARGETS. Exactly one, or none for the global default.
  company_scope_client_id uuid references public.clients(client_id) on delete cascade,
  workflow_template_id    uuid references public.workflow_templates(id) on delete cascade,
  job_id                  uuid references public.job_orders(job_id) on delete cascade,

  scope public.settings_scope not null generated always as (
    case when job_id                  is not null then 'job'::settings_scope
         when workflow_template_id    is not null then 'workflow'::settings_scope
         when company_scope_client_id is not null then 'client'::settings_scope
         else 'global'::settings_scope end
  ) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint automation_scope_settings_one_scope
    check (num_nonnulls(company_scope_client_id, workflow_template_id, job_id) <= 1),

  constraint automation_scope_settings_job_has_tenant
    check (job_id is null or tenant_client_id is not null),

  constraint automation_scope_settings_company_tenant_matches
    check (company_scope_client_id is null
           or tenant_client_id = company_scope_client_id),

  constraint automation_scope_settings_global_has_no_tenant
    check (num_nonnulls(company_scope_client_id, workflow_template_id, job_id) > 0
           or tenant_client_id is null),

  -- A resume date on an `off` row would describe a pause that isn't one, and on
  -- an `active` row nothing at all.
  constraint automation_scope_settings_resume_only_when_paused
    check (resume_at is null or state = 'paused')
);

comment on table public.automation_scope_settings is
  'Per-scope master switch over ALL automations. Resolves narrowest-wins along '
  'the same global -> company -> workflow -> job chain as automation_bindings, '
  'and acts as a ceiling: when it is not `active`, every automation at or below '
  'that scope is locked off. Absence of any row means `active`, so the table '
  'being empty preserves current behaviour exactly.';

comment on column public.automation_scope_settings.category is
  'null = every category. Otherwise an automation_definitions.category value. '
  'At equal scope a category-specific row beats a null one; a narrower scope '
  'beats both.';

comment on column public.automation_scope_settings.resume_at is
  'Honoured at RESOLVE time, not by a sweeper: an expired pause stops applying '
  'whether or not any cron has run. The sweep only tidies the dead row.';

-- One row per (target, category). Four partials because NULLs never collide in
-- a plain unique -- the same reason automation_bindings needs four, and what
-- makes the write path a safe read-then-insert-or-update.
create unique index automation_scope_settings_global_uniq
  on public.automation_scope_settings (coalesce(category, ''))
  where company_scope_client_id is null and workflow_template_id is null and job_id is null;
create unique index automation_scope_settings_company_uniq
  on public.automation_scope_settings (company_scope_client_id, coalesce(category, ''))
  where company_scope_client_id is not null;
create unique index automation_scope_settings_workflow_uniq
  on public.automation_scope_settings (workflow_template_id, coalesce(category, ''))
  where workflow_template_id is not null;
create unique index automation_scope_settings_job_uniq
  on public.automation_scope_settings (job_id, coalesce(category, ''))
  where job_id is not null;

create index idx_automation_scope_settings_scope   on public.automation_scope_settings (scope);
create index idx_automation_scope_settings_tenant  on public.automation_scope_settings (tenant_client_id);
create index idx_automation_scope_settings_company on public.automation_scope_settings (company_scope_client_id);
create index idx_automation_scope_settings_job     on public.automation_scope_settings (job_id);
-- The sweeper's only query.
create index idx_automation_scope_settings_resume  on public.automation_scope_settings (resume_at)
  where resume_at is not null;

create trigger set_automation_scope_settings_updated_at
  before update on public.automation_scope_settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Authority, not tenancy.
--
-- Every existing current_profile_* helper answers "which tenant is this", and
-- none answers "may this person decide for it". Turning an entire account's
-- automations off is consequential enough that the answer belongs in the policy
-- and not only in the server action.
-- ---------------------------------------------------------------------------
create or replace function public.current_profile_is_account_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select (p.side = 'stellaforce' and p.role = 'admin')
        or (p.side = 'client' and p.client_role = 'admin')
    from public.profiles p
    where p.id = auth.uid()
  ), false);
$$;

revoke execute on function public.current_profile_is_account_admin() from public;
grant  execute on function public.current_profile_is_account_admin() to authenticated;

alter table public.automation_scope_settings enable row level security;

-- Everyone reads. A recruiter who wonders why nothing sent must be able to be
-- told, and the header indicator needs this row under the caller's own session.
create policy "tenant_read_automation_scope_settings"
  on public.automation_scope_settings
  for select to authenticated
  using (
    public.current_profile_side() = 'stellaforce'
    or tenant_client_id is null
    or tenant_client_id = public.current_profile_client_id()
  );

-- Only account admins write, and only within their own tenant. Stellaforce-side
-- admins may write the global default (tenant null) and any client's row.
create policy "tenant_write_automation_scope_settings"
  on public.automation_scope_settings
  for all to authenticated
  using (
    public.current_profile_is_account_admin()
    and (
      public.current_profile_side() = 'stellaforce'
      or tenant_client_id = public.current_profile_client_id()
    )
  )
  with check (
    public.current_profile_is_account_admin()
    and (
      public.current_profile_side() = 'stellaforce'
      or tenant_client_id = public.current_profile_client_id()
    )
  );
