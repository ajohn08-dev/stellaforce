-- ─────────────────────────────────────────────────────────────────────────────
-- 0005 — Auth roles
--
-- Users are created manually in Supabase Auth (no public sign-up). Every
-- auth.users row gets a matching public.profiles row via trigger, defaulting
-- to role = 'recruiter'; roles are hand-promoted afterward via SQL, e.g.:
--   update public.profiles set role = 'admin' where email = 'someone@example.com';
--
-- Role is stored but NOT yet enforced anywhere — every authenticated user still
-- has full CRUD via the existing permissive policies (0004_rls.sql). This just
-- gates the platform behind login and gives each user a role for later use.
-- ─────────────────────────────────────────────────────────────────────────────

create type user_role as enum ('recruiter', 'manager', 'admin');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role user_role not null default 'recruiter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Auto-provision a profile row whenever a user is created in auth.users.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

alter table profiles enable row level security;

-- Any authenticated user can read all profiles (needed to show names/roles in
-- the UI). No insert/update/delete policy for authenticated — role changes go
-- through SQL editor / service-role only, so no self-service role escalation.
create policy "profiles_select_authenticated" on profiles
  for select
  to authenticated
  using (true);
