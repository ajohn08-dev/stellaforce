-- 20260913130000 — candidate search enrichment state
--
-- One row per candidate recording whether their **derived** search data has
-- been reconciled, what still needs a human, and whether the work is owed. It
-- is the answer to the question nobody could ask before: "are there candidates
-- stored but not meaningfully searchable, and how many?"
--
-- **Every candidate stays searchable regardless of what is in this table.**
-- Name, raw title text, city, skills and years reach every candidate always.
-- This table never gates a query. It records what is *derived* and what is
-- missing — the normalized role filters can only match a candidate who has a
-- classification, and that is a property of `candidates.canonical_role_id`,
-- not of a flag here.
--
-- There is deliberately **no `is_searchable` column**. It would have stored
-- `candidates.canonical_role_id is not null` a second time, on a different
-- table, with a different writer: `setCandidateTitleClassification` writes that
-- column directly, so the two would disagree the moment a recruiter classified
-- someone from their profile. A column named "is_searchable" also promises
-- something far larger than it means — the next person to write a query would
-- reasonably add `where is_searchable`, and enrichment state would start
-- hiding people from search. `is_classified` is derived in the view below.
--
-- Not a setting, and deliberately not in Settings: nothing here is a dial an
-- admin turns. It is operational truth, maintained by the app.

-- ---------------------------------------------------------------------------
-- Readiness vocabulary
-- ---------------------------------------------------------------------------
--
-- `failed` means *our* reconciliation failed — a query error, a bug, a lost
-- lease. It never describes the candidate, and it never changes what a
-- recruiter can find. A résumé that parsed badly is `ready_with_review` with a
-- reason, because the parse is what went wrong, not the reconciliation.

create type search_readiness as enum (
  'pending',
  'ready',
  'ready_with_review',
  'failed'
);

-- ---------------------------------------------------------------------------
-- candidate_search_state
-- ---------------------------------------------------------------------------

create table candidate_search_state (
  -- One-to-one with the candidate, and CASCADE so a deleted candidate needs no
  -- cleanup anywhere — the sweep can never resurrect a row that has no person.
  candidate_id uuid primary key
    references candidates(candidate_id) on delete cascade,

  readiness search_readiness not null default 'pending',

  -- Stable machine codes, sorted and de-duplicated by the app before writing so
  -- two identical states cannot differ by ordering. Mirrors the
  -- `ingestion_jobs.needs_review_reasons` convention.
  review_reasons text[] not null default '{}',

  -- The outbox, such as it is. Set by the triggers below and by any caller that
  -- wants a sweep to revisit this candidate. Non-null and newer than
  -- `reconciled_watermark` means work is owed.
  search_dirty_at timestamptz,

  reconciled_at timestamptz,
  -- The `search_dirty_at` value observed when the last run *started*. This is
  -- the stale-job defence: a write landing mid-run leaves
  -- `search_dirty_at > reconciled_watermark`, so the row stays dirty and is
  -- swept again. A run that began before newer data can never mark it clean.
  reconciled_watermark timestamptz,

  -- Lease, same shape as `claim_due_agent_calls`. Only the sweep claims; the
  -- in-process callers are already inside the flow that made the change.
  claimed_at timestamptz,
  claimed_by text,

  -- Consecutive failures, reset to 0 on success. `last_error` is a truncated
  -- message and must never contain candidate text.
  attempt_count int not null default 0,
  last_error text,

  -- The rule-set version that produced this row. Bumping the constant in
  -- application code invalidates every row without a migration.
  enrichment_version int not null default 0,

  -- The one link from "this candidate isn't classified" back to the delivery
  -- that produced them. SET NULL rather than CASCADE: losing the job row must
  -- not lose the candidate's state.
  last_ingestion_job_id uuid references ingestion_jobs(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_candidate_search_state_updated
  before update on candidate_search_state
  for each row execute function set_updated_at();

-- The sweep's selection predicate: dirty rows first, then version-invalidated,
-- then failures due a retry. Partial where it can be.
create index idx_candidate_search_state_dirty
  on candidate_search_state (search_dirty_at)
  where search_dirty_at is not null;
create index idx_candidate_search_state_readiness
  on candidate_search_state (readiness);
create index idx_candidate_search_state_version
  on candidate_search_state (enrichment_version);

comment on table candidate_search_state is
  'Derived-search reconciliation state, one row per candidate. Never gates search; every candidate is always searchable.';
comment on column candidate_search_state.reconciled_watermark is
  'The search_dirty_at observed when the last run started — stops a stale run marking newer data clean.';
comment on column candidate_search_state.readiness is
  'failed = our reconciliation failed, never a statement about the candidate.';

-- ---------------------------------------------------------------------------
-- The operational view
-- ---------------------------------------------------------------------------
--
-- Everything answerable from rows that already exist is derived here rather
-- than stored, so it cannot go stale: classification coverage, staleness,
-- whether a candidate has ever been reconciled, and time-to-ready.
--
-- Carries no name, email, phone or title — this is a counting surface, and the
-- candidate_id is enough to navigate to the profile that holds the rest.

create view candidate_search_readiness as
select
  s.candidate_id,
  s.readiness,
  s.review_reasons,
  s.attempt_count,
  s.last_error,
  s.enrichment_version,
  s.last_ingestion_job_id,
  s.reconciled_at,
  s.search_dirty_at,
  -- The only "can the normalized filters match them" answer there should be.
  (c.canonical_role_id is not null) as is_classified,
  (s.reconciled_at is null) as never_reconciled,
  (
    s.search_dirty_at is not null
    and (s.reconciled_watermark is null or s.search_dirty_at > s.reconciled_watermark)
  ) as is_stale,
  (s.reconciled_at - c.date_added) as time_to_ready
from candidate_search_state s
join candidates c on c.candidate_id = s.candidate_id;

comment on view candidate_search_readiness is
  'Derived operational read over candidate_search_state. No candidate PII.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
--
-- Stellaforce-side only, on both commands and both directions. This is internal
-- operational data about the global candidate brain: unlike `candidates` there
-- is no case where a client user legitimately reads it, so there is no read
-- predicate to soften.
--
-- Note the trigger function below is SECURITY DEFINER precisely so these
-- policies cannot stop a dirty flag being recorded. Losing the flag would mean
-- losing the work silently, which is the one failure this table exists to
-- prevent.

alter table candidate_search_state enable row level security;

create policy candidate_search_state_select on candidate_search_state
  for select to authenticated
  using (public.current_profile_side() = 'stellaforce');

create policy candidate_search_state_insert on candidate_search_state
  for insert to authenticated
  with check (public.current_profile_side() = 'stellaforce');

create policy candidate_search_state_update on candidate_search_state
  for update to authenticated
  using (public.current_profile_side() = 'stellaforce')
  with check (public.current_profile_side() = 'stellaforce');

create policy candidate_search_state_delete on candidate_search_state
  for delete to authenticated
  using (public.current_profile_side() = 'stellaforce');
