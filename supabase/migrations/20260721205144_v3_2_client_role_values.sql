-- ─────────────────────────────────────────────────────────────────────────────
-- V3.2 — client_role: add reviewer/recruiter (was member|admin only, from
-- 0007_client_profiles.sql). Split into its own migration since a new enum
-- value cannot be used in the same transaction that adds it.
-- ─────────────────────────────────────────────────────────────────────────────

alter type client_role add value 'reviewer';
alter type client_role add value 'recruiter';
