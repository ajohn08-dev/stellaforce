-- 20260913110300 — seed the V1 title taxonomy
--
-- Fifteen canonical roles and the deterministic whole-title aliases that map
-- onto them, sized to what Stellaforce recruits for today (sales-led, plus the
-- adjacent product/design/engineering roles) rather than to a global
-- occupational taxonomy nobody maintains.
--
-- Idempotent on the stable keys — `lower(slug)` and `lower(alias)`, the two
-- expression unique indexes from 20260913110100 — so re-running this migration,
-- or seeding a fresh environment, converges to the same rows.
--
-- Deliberately ABSENT: broad single-word aliases ("sales", "engineer",
-- "manager", "executive", "director"). Each would match dozens of unrelated
-- titles as a whole string in its own right, and worse, each is a word that
-- appears inside the aliases we do seed — so seeding them invites exactly the
-- substring thinking this design refuses. A title that is only "Sales" stays
-- unclassified, which is the honest answer.
--
-- `npm run title-check` asserts this seed stays in step with the TypeScript
-- fixture the normalizer is tested against, so the two cannot drift.

-- ---------------------------------------------------------------------------
-- Canonical roles
-- ---------------------------------------------------------------------------

insert into public.canonical_roles (slug, label, role_family) values
  ('account_executive', 'Account Executive', 'sales'),
  ('sales_development_rep', 'Sales Development Representative', 'sales'),
  ('account_manager', 'Account Manager', 'sales'),
  ('sales_engineer', 'Sales Engineer', 'sales'),
  ('sales_leadership', 'Sales Leadership', 'sales'),
  ('customer_success_manager', 'Customer Success Manager', 'customer_success'),
  ('product_marketing_manager', 'Product Marketing Manager', 'marketing'),
  ('demand_generation_manager', 'Demand Generation Manager', 'marketing'),
  ('product_manager', 'Product Manager', 'product'),
  ('product_designer', 'Product Designer', 'design'),
  ('software_engineer', 'Software Engineer', 'engineering'),
  ('data_engineer', 'Data Engineer', 'engineering'),
  ('engineering_manager', 'Engineering Manager', 'engineering'),
  ('revenue_operations', 'Revenue Operations', 'operations'),
  ('recruiter', 'Recruiter', 'operations')
on conflict (lower(slug)) do update
  set label       = excluded.label,
      role_family = excluded.role_family,
      is_active   = true,
      updated_at  = now();

-- ---------------------------------------------------------------------------
-- Aliases
-- ---------------------------------------------------------------------------
--
-- Columns: alias, role slug (null when ambiguous), implied seniority,
-- is_ambiguous.
--
-- `implied_seniority` exists only for aliases whose text *bakes the rung in*
-- ("VP of Sales" is always a VP). It is a fallback, not the primary path: the
-- normalizer extracts the seniority word from the raw title itself, which is
-- what handles "Senior Account Executive" without an alias row per combination.
--
-- The `enterprise …` / `strategic …` aliases are seeded as whole titles because
-- those words are extremely common in sales titles and the role underneath is
-- unambiguous. They resolve to the same canonical role as the plain form — the
-- qualifier itself is NOT stored anywhere, by design (see the enum migration).

insert into public.title_aliases
  (alias, canonical_role_id, implied_seniority, is_ambiguous)
select
  v.alias,
  r.id,
  v.implied_seniority::public.title_seniority,
  v.is_ambiguous
from (values
  -- Account Executive
  ('account executive',                'account_executive',        null::text, false),
  ('ae',                               'account_executive',        null::text, false),
  ('enterprise account executive',     'account_executive',        null::text, false),
  ('enterprise ae',                    'account_executive',        null::text, false),
  ('strategic account executive',      'account_executive',        null::text, false),
  ('strategic ae',                     'account_executive',        null::text, false),
  -- Sales Development Representative
  ('sales development representative', 'sales_development_rep',    null::text, false),
  ('sdr',                              'sales_development_rep',    null::text, false),
  -- Account Manager
  ('account manager',                  'account_manager',          null::text, false),
  -- Sales Engineer
  ('sales engineer',                   'sales_engineer',           null::text, false),
  ('solutions engineer',               'sales_engineer',           null::text, false),
  -- Sales Leadership (the rung lives in seniority, not in a role per title)
  ('vp of sales',                      'sales_leadership',         'vp',       false),
  ('vice president of sales',          'sales_leadership',         'vp',       false),
  ('head of sales',                    'sales_leadership',         'director', false),
  ('chief revenue officer',            'sales_leadership',         'c_level',  false),
  ('cro',                              'sales_leadership',         'c_level',  false),
  -- Customer Success
  ('customer success manager',         'customer_success_manager', null::text, false),
  ('csm',                              'customer_success_manager', null::text, false),
  -- Marketing
  ('product marketing manager',        'product_marketing_manager',null::text, false),
  ('demand generation manager',        'demand_generation_manager',null::text, false),
  ('demand gen manager',               'demand_generation_manager',null::text, false),
  -- Product / Design
  ('product manager',                  'product_manager',          null::text, false),
  ('product designer',                 'product_designer',         null::text, false),
  -- Engineering
  ('software engineer',                'software_engineer',        null::text, false),
  ('software developer',               'software_engineer',        null::text, false),
  ('full stack engineer',              'software_engineer',        null::text, false),
  ('full-stack engineer',              'software_engineer',        null::text, false),
  ('data engineer',                    'data_engineer',            null::text, false),
  ('engineering manager',              'engineering_manager',      null::text, false),
  -- Operations
  ('revenue operations',               'revenue_operations',       null::text, false),
  ('revops',                           'revenue_operations',       null::text, false),
  ('revenue operations manager',       'revenue_operations',       null::text, false),
  ('recruiter',                        'recruiter',                null::text, false),
  ('talent acquisition partner',       'recruiter',                null::text, false),
  -- Declared ambiguities: mapped to nothing, on purpose. "PM" is Product,
  -- Project or Program Manager; "AM" is Account Manager or Asset Manager;
  -- "SE" is Sales, Solutions, Software or Systems Engineer. Guessing any of
  -- them puts a candidate in a search result they do not belong in.
  ('pm',                               null,                       null::text, true),
  ('am',                               null,                       null::text, true),
  ('se',                               null,                       null::text, true)
) as v(alias, role_slug, implied_seniority, is_ambiguous)
left join public.canonical_roles r on lower(r.slug) = v.role_slug
on conflict (lower(alias)) do update
  set canonical_role_id = excluded.canonical_role_id,
      implied_seniority = excluded.implied_seniority,
      is_ambiguous      = excluded.is_ambiguous,
      updated_at        = now();

-- A mapped alias whose role slug did not resolve would silently become an
-- unmapped, non-ambiguous row — which the ambiguity CHECK rejects, but only if
-- the insert reaches it. Fail loudly here instead of leaving a rule missing.
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
