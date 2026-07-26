-- ─────────────────────────────────────────────────────────────────────────────
-- V3.2 — candidates: add new columns, backfill from full_name/contact_info/education
-- ─────────────────────────────────────────────────────────────────────────────

alter table candidates
  add column first_name text,
  add column last_name text,
  add column email text,
  add column phone text,
  add column location_city text,
  add column location_state text,
  add column location_country text,
  add column location_raw text,
  add column timezone text,
  add column is_open_to_remote boolean default false,
  add column is_open_to_relocation boolean default false,
  add column github_url text,
  add column resume_path text,
  add column avatar_url text,
  add column source_metadata jsonb,
  add column data_confidence_score numeric(5,2),
  add column data_confidence_breakdown jsonb,
  add column last_scored_at timestamptz;

-- Backfill name split (all live rows at migration time were simple "First
-- Last") and contact_info unpack. location_country defaulted to 'US' based
-- on the live data (US cities/phone numbers) — revisit if non-US candidates
-- are added without a real country field being parsed.
update candidates set
  first_name = split_part(full_name, ' ', 1),
  last_name  = substring(full_name from position(' ' in full_name) + 1),
  email = contact_info->>'email',
  phone = contact_info->>'phone',
  timezone = contact_info->>'tz',
  location_raw = contact_info->>'location',
  location_city = split_part(contact_info->>'location', ', ', 1),
  location_state = nullif(split_part(contact_info->>'location', ', ', 2), ''),
  location_country = 'US';

-- Migrate the single-entry education jsonb blobs into candidate_education.
insert into candidate_education (candidate_id, institution_name, degree, field_of_study)
select candidate_id, elem->>'institution', elem->>'degree', elem->>'field_of_study'
from candidates, jsonb_array_elements(education) as elem
where education is not null;
