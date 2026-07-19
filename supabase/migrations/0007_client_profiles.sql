-- ─────────────────────────────────────────────────────────────────────────────
-- 0007 — Client-side profiles
--
-- Two "sides" of the platform now share the profiles table:
--   - stellaforce: internal staff, role = recruiter | manager | admin (0005)
--   - client:      a person at a client company, client_role = member | admin,
--                   linked to their company via client_id -> clients
--
-- Provisioning follows the same manual pattern as 0005: create the auth user
-- in the dashboard, then hand-set side/client_id/client_role via SQL, e.g.:
--   update public.profiles
--   set side = 'client', client_id = '<clients.client_id>', client_role = 'admin'
--   where email = 'someone@client-co.com';
--
-- Like `role`, these new columns are stored but not yet RLS-enforced — every
-- authenticated user (including client-side ones) still has full CRUD via the
-- existing permissive policies (0004_rls.sql). Scoping client-side users to
-- only their own client's data is a follow-up pass, not part of this change.
-- ─────────────────────────────────────────────────────────────────────────────

create type profile_side as enum ('stellaforce', 'client');
create type client_role as enum ('member', 'admin');

alter table profiles
  add column side profile_side not null default 'stellaforce',
  add column client_id uuid references clients(client_id) on delete set null,
  add column client_role client_role;

-- A profile is either fully on the Stellaforce side (no client linkage) or
-- fully on a client's side (linked to exactly one client, with a client role).
alter table profiles
  add constraint chk_profiles_side_consistency check (
    (side = 'stellaforce' and client_id is null and client_role is null)
    or
    (side = 'client' and client_id is not null and client_role is not null)
  );

create index idx_profiles_client_id on profiles(client_id);
