-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: deleting a job failed because `job_created` (and other job-only) events
-- are `ON DELETE SET NULL` on job_id, which would null the only scope column and
-- violate `activity_events_scope_present`. Those events carry `client_id`, so
-- broaden the check to accept it — the audit event is preserved (just detached
-- from the deleted job) instead of blocking the delete.
-- ─────────────────────────────────────────────────────────────────────────────

alter table activity_events drop constraint activity_events_scope_present;
alter table activity_events add constraint activity_events_scope_present
  check (
    client_id is not null
    or candidate_id is not null
    or job_id is not null
    or application_id is not null
  );
