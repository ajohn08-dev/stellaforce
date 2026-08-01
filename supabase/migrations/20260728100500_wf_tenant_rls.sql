-- ─────────────────────────────────────────────────────────────────────────────
-- Tenant-scoped RLS for the new sensitive tables (templates, settings,
-- activity_events, ai_interactions, audit_log). Client-side users may only
-- reach their own client's rows (plus global rows); Stellaforce-side users see
-- everything. This is stricter than the permissive `authenticated` policy used
-- elsewhere, because these tables hold cross-client PII + hiring decisions.
--
-- Read (USING): stellaforce, OR the row is global (client_id null), OR the
--   row's client_id matches the caller's.
-- Write (WITH CHECK): stellaforce may write anything; a client user may only
--   write rows scoped to their own client (never a global row).
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: the caller's side + client_id, read from profiles bypassing RLS.
-- SECURITY DEFINER + fixed search_path per the linter guidance; each returns
-- only the caller's own attribute, so exposure is nil.
create or replace function public.current_profile_side()
returns profile_side
language sql
stable
security definer
set search_path = ''
as $$
  select side from public.profiles where id = auth.uid();
$$;

create or replace function public.current_profile_client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select client_id from public.profiles where id = auth.uid();
$$;

revoke execute on function public.current_profile_side() from public;
revoke execute on function public.current_profile_client_id() from public;
grant execute on function public.current_profile_side() to authenticated;
grant execute on function public.current_profile_client_id() to authenticated;

-- Settings tables need a denormalized client_id so the tenant policy filters
-- uniformly (null = global/platform; set = the owning client for
-- client/workflow/job-scoped overrides). Server actions populate it.
alter table workflow_settings       add column client_id uuid references clients(client_id) on delete cascade;
alter table sla_policies            add column client_id uuid references clients(client_id) on delete cascade;
alter table automation_rules        add column client_id uuid references clients(client_id) on delete cascade;
alter table communication_templates add column client_id uuid references clients(client_id) on delete cascade;

create index idx_workflow_settings_client on workflow_settings(client_id);
create index idx_sla_policies_client on sla_policies(client_id);
create index idx_automation_rules_client on automation_rules(client_id);
create index idx_communication_templates_client on communication_templates(client_id);

-- Apply the tenant policy to every sensitive table (all carry client_id).
do $$
declare
  tbl text;
  tables text[] := array[
    'workflow_templates', 'workflow_settings', 'sla_policies',
    'automation_rules', 'communication_templates',
    'activity_events', 'ai_interactions', 'audit_log'
  ];
begin
  foreach tbl in array tables loop
    execute format($f$
      create policy "tenant_read_%1$s" on %1$I
        for select to authenticated
        using (
          public.current_profile_side() = 'stellaforce'
          or client_id is null
          or client_id = public.current_profile_client_id()
        );
    $f$, tbl);

    execute format($f$
      create policy "tenant_write_%1$s" on %1$I
        for all to authenticated
        using (
          public.current_profile_side() = 'stellaforce'
          or client_id = public.current_profile_client_id()
        )
        with check (
          public.current_profile_side() = 'stellaforce'
          or client_id = public.current_profile_client_id()
        );
    $f$, tbl);
  end loop;
end $$;
