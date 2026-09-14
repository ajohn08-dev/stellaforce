-- 20260913110000 — title normalization enums
--
-- V1 candidate title normalization: three controlled vocabularies for the
-- *classification* of a candidate's current title. None of them replaces a raw
-- title — `candidates.current_title`, `candidates.headline` and
-- `candidate_work_experiences.title` keep their exact meaning and values, and
-- nothing in this feature ever writes to them.
--
-- Deliberately NO `unknown` / `other` member on either vocabulary. Unclassified
-- is a *state* — a null column — not a value: a row nobody could map and a row
-- classified as "other" look identical in a filter the moment `other` exists,
-- and the first is work to do while the second is a decision. The companion
-- `title_normalization_source` column distinguishes "never attempted" (null)
-- from "attempted, matched nothing" (source null + `normalized_from_title` set).
--
-- `title_normalization_source` has two members, not three: V1 is deterministic
-- rules plus recruiter overrides. There is no LLM classification path, so an
-- `llm` member would name behaviour that does not exist.
--
-- There is deliberately no sales-segment vocabulary. "Enterprise" and
-- "Strategic" stay in the raw title, where the existing free-text "Title
-- contains" filter already finds them; promoting them to a structured field is
-- a V2 decision that needs its own definition of what the word claims.

create type role_family as enum (
  'sales',
  'customer_success',
  'marketing',
  'product',
  'design',
  'engineering',
  'operations'
);

-- One ladder for two tracks, knowingly: `staff`/`principal` (IC) and
-- `manager`/`director` (people) are not comparable rungs, and "Senior Manager"
-- has to pick one. A `track` axis is the correct fix and is out of scope here.
-- A bare "Account Executive" is `null`, never `mid`: the title states no rung.
create type title_seniority as enum (
  'intern',
  'entry',
  'mid',
  'senior',
  'staff',
  'principal',
  'manager',
  'director',
  'vp',
  'c_level'
);

create type title_normalization_source as enum (
  'rule',
  'recruiter'
);
