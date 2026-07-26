-- ─────────────────────────────────────────────────────────────────────────────
-- V3.2 — applications: replace the fixed `stage` enum with `current_stage_id`
-- (FK to job_workflow_sub_stages, since stages are now configurable per job)
-- plus a coarser `status` and `job_fit_score`. 0 rows at migration time —
-- no data loss. status_reason/human_review_flag/client_id are kept as-is.
-- ─────────────────────────────────────────────────────────────────────────────

alter table applications
  add column current_stage_id uuid references job_workflow_sub_stages(id) on delete set null,
  add column status application_status not null default 'active',
  add column job_fit_score numeric(5,2),
  drop column stage;

drop type application_stage;
