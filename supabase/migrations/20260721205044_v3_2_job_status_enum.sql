-- ─────────────────────────────────────────────────────────────────────────────
-- V3.2 — job_status: rename on_hold -> paused, add draft.
-- Split into its own migration: a new enum value cannot be used in the same
-- transaction that adds it.
-- ─────────────────────────────────────────────────────────────────────────────

alter type job_status rename value 'on_hold' to 'paused';
alter type job_status add value 'draft' before 'open';
