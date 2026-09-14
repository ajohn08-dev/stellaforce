-- 20260913120000 — title taxonomy coverage pass 1
--
-- Forward-only. Adds two canonical roles and twelve exact aliases identified by
-- the coverage audit of the first deterministic backfill (7 of 28 mapped).
-- Nothing here rewrites 20260913110300 — that seed stays exactly as it shipped.
--
-- **Two new roles, both because no existing role could take these titles
-- safely.** Channel/partner sales was the largest single cluster in the miss
-- set, and it is neither `account_executive` (different motion, indirect quota)
-- nor `account_manager`; mapping it to either would put the wrong people in an
-- AE search. A recruiting coordinator is not a `recruiter` — coordinators
-- schedule and support, they do not own requisitions — so that mapping would be
-- wrong in the same way.
--
-- **Nothing else was added, deliberately.** Client Executive resolves to
-- different roles at different employers; Senior Engineer, Technical Lead, Team
-- Lead and AI/ML Engineer reduce to the broad words this design forbids as
-- aliases. All of them stay unclassified and are a recruiter-override job.
--
-- Idempotent on the same stable keys as the original seed — `lower(slug)` and
-- `lower(alias)`, the expression unique indexes from 20260913110100.

-- ---------------------------------------------------------------------------
-- Canonical roles
-- ---------------------------------------------------------------------------

insert into public.canonical_roles (slug, label, role_family) values
  ('channel_partner_sales', 'Channel / Partner Sales', 'sales'),
  ('recruiting_coordinator', 'Recruiting Coordinator', 'operations')
on conflict (lower(slug)) do update
  set label       = excluded.label,
      role_family = excluded.role_family,
      is_active   = true,
      updated_at  = now();

-- ---------------------------------------------------------------------------
-- Aliases
-- ---------------------------------------------------------------------------
--
-- Columns: alias, role slug, implied seniority, is_ambiguous — the same shape
-- as the original seed so both files parse identically for `npm run title-check`.
--
-- Every alias below is a WHOLE title and carries no implied seniority: the
-- seniority pass already lifts "Senior"/"Sr"/"Lead" out of the raw title, which
-- is why one `corporate recruiter` row covers "Senior Corporate Recruiter" and
-- one `channel manager` row covers "Senior Channel Manager".
--
-- `bdr` is an abbreviation and is treated as medium confidence by the
-- normalizer (alongside `ae`); that lives in code rather than here, because
-- confidence is a property of the rule's reliability, not of the row.

insert into public.title_aliases
  (alias, canonical_role_id, implied_seniority, is_ambiguous)
select
  v.alias,
  r.id,
  v.implied_seniority::public.title_seniority,
  v.is_ambiguous
from (values
  -- Existing roles: qualifiers that name a vertical, a book of business, or a
  -- company stage, where the role word itself is already explicit.
  ('healthcare account executive',       'account_executive',      null::text, false),
  ('major account executive',            'account_executive',      null::text, false),
  -- BDR and SDR are the same top-of-funnel role industry-wide.
  ('business development representative','sales_development_rep',  null::text, false),
  ('bdr',                                'sales_development_rep',  null::text, false),
  -- "Corporate" distinguishes in-house from agency, not the role.
  ('corporate recruiter',                'recruiter',              null::text, false),
  -- "Founding" is a company-stage marker, not a rung — no implied seniority.
  ('founding product designer',          'product_designer',       null::text, false),
  ('application developer',              'software_engineer',      null::text, false),
  -- New roles.
  ('channel manager',                    'channel_partner_sales',  null::text, false),
  ('channel sales executive',            'channel_partner_sales',  null::text, false),
  ('partner manager',                    'channel_partner_sales',  null::text, false),
  ('recruiting coordinator',             'recruiting_coordinator', null::text, false),
  ('recruitment coordinator',            'recruiting_coordinator', null::text, false)
) as v(alias, role_slug, implied_seniority, is_ambiguous)
left join public.canonical_roles r on lower(r.slug) = v.role_slug
on conflict (lower(alias)) do update
  set canonical_role_id = excluded.canonical_role_id,
      implied_seniority = excluded.implied_seniority,
      is_ambiguous      = excluded.is_ambiguous,
      updated_at        = now();

-- Same guard as the original seed: a mapped alias whose role slug failed to
-- resolve would be a silently missing rule.
do $$
declare
  v_orphans int;
begin
  select count(*) into v_orphans
  from public.title_aliases
  where not is_ambiguous and canonical_role_id is null;

  if v_orphans > 0 then
    raise exception 'seed produced % alias rows with no canonical role', v_orphans;
  end if;
end;
$$;
