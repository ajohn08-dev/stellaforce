-- ─────────────────────────────────────────────────────────────────────────────
-- V3.2 — candidates: finalize first_name/last_name, convert full_name to
-- generated, add email uniqueness, drop deprecated jsonb columns
-- (run only after verifying the backfill in the prior migration).
-- ─────────────────────────────────────────────────────────────────────────────

alter table candidates
  alter column first_name set not null,
  alter column last_name set not null;

alter table candidates drop column full_name;
alter table candidates
  add column full_name text generated always as (first_name || ' ' || last_name) stored;

alter table candidates add constraint candidates_email_key unique (email);

alter table candidates
  drop column contact_info,
  drop column education,
  drop column certifications;
