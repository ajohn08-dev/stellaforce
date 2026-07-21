-- ─────────────────────────────────────────────────────────────────────────────
-- V3.2 — job_orders: add Role Definition / Add Job dialog fields, drop
-- required_skills (superseded by job_competencies.skills[]) and salary_range
-- jsonb (superseded by flat salary_from/to/currency). 0 rows at migration
-- time — no data loss.
-- ─────────────────────────────────────────────────────────────────────────────

alter table job_orders
  alter column status set default 'draft'::job_status,
  add column workplace_type workplace_type,
  add column office_location text,
  add column location text,
  add column description_file_path text,
  add column requisition_file_path text,
  add column company text,
  add column industry text,
  add column job_function text,
  add column employment_type employment_type,
  add column experience_required text,
  add column education_required text,
  add column salary_from numeric(12,2),
  add column salary_to numeric(12,2),
  add column salary_currency text default 'USD',
  drop column required_skills,
  drop column salary_range;
