-- 20260913110200 — candidate-level title normalization columns
--
-- The classification of a candidate's CURRENT title, stored beside the raw
-- title rather than on top of it. This migration adds columns and indexes and
-- nothing else: it does not read, modify, backfill or delete any existing
-- value, and in particular it never touches `current_title`, `headline`, or
-- `candidate_work_experiences.title`. Backfill is a separate, dry-runnable
-- script (`npm run title-backfill`).
--
-- Every column is nullable, and null means "unclassified" on purpose — see the
-- enum migration for why there is no `unknown` member to write instead.
--
-- Scope note: V1 normalizes `candidates.current_title` only. Work-experience
-- rows are deliberately untouched — `upsertWorkExperiences` deletes and
-- recreates every resume-sourced row on re-parse, so a column stored there
-- would lose its value (and any recruiter override of it) on the next upload.

alter table candidates
  -- ON DELETE SET NULL rather than RESTRICT: retiring a role from the taxonomy
  -- should not be blocked by, or silently delete, a candidate.
  add column canonical_role_id uuid references canonical_roles(id) on delete set null,
  add column role_family role_family,
  add column seniority title_seniority,
  add column title_normalization_source title_normalization_source,
  -- Reuses the existing `confidence_level` enum (low|medium|high) rather than
  -- inventing a numeric score nothing calibrates.
  add column title_normalization_confidence confidence_level,
  -- The exact raw title this classification was computed from. This is what
  -- makes an override survive a re-parse: `current_title` is overwritten by
  -- ingestion, so without this column there is no record of what the existing
  -- mapping was based on, and "did the title change?" becomes unanswerable.
  add column normalized_from_title text,
  add column title_normalized_at timestamptz;

create index idx_candidates_canonical_role on candidates (canonical_role_id);
create index idx_candidates_role_family on candidates (role_family);
create index idx_candidates_seniority on candidates (seniority);

comment on column candidates.normalized_from_title is
  'The exact raw current_title this classification was computed from; drives the re-parse/override policy.';
comment on column candidates.title_normalization_source is
  'rule = deterministic alias match, recruiter = manual override (sticky across re-parse), null = never classified.';
