-- 20260913110100 — title taxonomy: canonical_roles + title_aliases
--
-- The vocabulary a candidate's current title is classified against, and the
-- deterministic rules that do the classifying. Both are *lookup* tables in the
-- same sense as `skills` / `tools`: global, recruiting-wide, holding no
-- candidate data. Read is open to any authenticated user for the same reason
-- those two are; writes are Stellaforce-side only, because a client user
-- editing the taxonomy would change how every other client's candidates
-- classify.
--
-- Roles live in a table rather than an enum because they grow: adding
-- "Solutions Architect" should be a row, not a migration. Families do not grow
-- the same way and are an enum (see 20260913110000).

-- ---------------------------------------------------------------------------
-- canonical_roles
-- ---------------------------------------------------------------------------

create table canonical_roles (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null,
  label       text not null,
  role_family role_family not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Unique on lower(slug), matching the `skills`/`tools` precedent in
-- 20260727130000_skills_tools_case_insensitive.sql. An expression index is also
-- a valid ON CONFLICT target, which is what makes the seed idempotent.
create unique index canonical_roles_slug_lower_key
  on canonical_roles (lower(slug));

create index idx_canonical_roles_family on canonical_roles (role_family);

create trigger trg_canonical_roles_updated
  before update on canonical_roles
  for each row execute function set_updated_at();

comment on table canonical_roles is
  'Global role vocabulary a candidate''s current title is classified against. Never candidate data.';

-- ---------------------------------------------------------------------------
-- title_aliases
-- ---------------------------------------------------------------------------
--
-- The deterministic rule set, as data. Every alias is a WHOLE title, matched by
-- exact case-insensitive equality — never a substring. Substring matching is
-- what turns "Sales Engineer" into a match for a "sales" rule and "Account
-- Manager" into "Account Executive"; whole-string matching is the entire safety
-- property of this feature.
--
-- `canonical_role_id` is nullable for exactly one reason: an alias may be
-- *known ambiguous* ("PM" is Product, Project, or Program Manager). Such a row
-- maps to nothing on purpose, so the normalizer can decline knowing why rather
-- than because no rule happened to exist.

create table title_aliases (
  id                uuid primary key default gen_random_uuid(),
  alias             text not null,
  canonical_role_id uuid references canonical_roles(id) on delete restrict,
  -- Only for aliases whose text bakes the rung in ("VP of Sales" is always a
  -- VP). The primary path is extracting the seniority word from the raw title.
  implied_seniority title_seniority,
  is_ambiguous      boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Exactly two valid shapes: a real mapping, or a declared ambiguity. A row
  -- that is neither (ambiguous *and* mapped, or unambiguous *and* unmapped) is
  -- a rule the normalizer cannot act on either way.
  constraint title_aliases_ambiguity_ck check (
    (is_ambiguous and canonical_role_id is null)
    or (not is_ambiguous and canonical_role_id is not null)
  )
);

create unique index title_aliases_alias_lower_key
  on title_aliases (lower(alias));

create index idx_title_aliases_role on title_aliases (canonical_role_id);

create trigger trg_title_aliases_updated
  before update on title_aliases
  for each row execute function set_updated_at();

comment on table title_aliases is
  'Whole-title alias rules. Exact case-insensitive equality only — never substring matching.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
--
-- Read mirrors `skills` / `tools`: any authenticated user. These tables are a
-- vocabulary of job-title strings — no candidate is identifiable from them, and
-- scoping them would fragment the lookup every classification depends on.
--
-- Write is Stellaforce-side only, enforced by the same `current_profile_side()`
-- helper the tenant policies use. Client-side profiles get no insert, update or
-- delete policy at all, which is a refusal rather than a filtered result.

alter table canonical_roles enable row level security;
alter table title_aliases  enable row level security;

create policy canonical_roles_select on canonical_roles
  for select to authenticated using (true);

create policy canonical_roles_insert on canonical_roles
  for insert to authenticated
  with check (public.current_profile_side() = 'stellaforce');

create policy canonical_roles_update on canonical_roles
  for update to authenticated
  using (public.current_profile_side() = 'stellaforce')
  with check (public.current_profile_side() = 'stellaforce');

create policy canonical_roles_delete on canonical_roles
  for delete to authenticated
  using (public.current_profile_side() = 'stellaforce');

create policy title_aliases_select on title_aliases
  for select to authenticated using (true);

create policy title_aliases_insert on title_aliases
  for insert to authenticated
  with check (public.current_profile_side() = 'stellaforce');

create policy title_aliases_update on title_aliases
  for update to authenticated
  using (public.current_profile_side() = 'stellaforce')
  with check (public.current_profile_side() = 'stellaforce');

create policy title_aliases_delete on title_aliases
  for delete to authenticated
  using (public.current_profile_side() = 'stellaforce');
