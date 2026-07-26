-- ─────────────────────────────────────────────────────────────────────────────
-- V3.2 — clients: additive only. client_name/status/notes are kept as-is
-- (both live rows had real status/notes data — decision: preserve, don't drop).
-- ─────────────────────────────────────────────────────────────────────────────

alter table clients
  add column industry text,
  add column website_url url;
