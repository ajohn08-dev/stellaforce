-- ─────────────────────────────────────────────────────────────────────────────
-- V3.2 fixup — `headline` was documented in the V3.2 candidates table but
-- missed in the original candidates_add_columns migration. Adding it here.
-- ─────────────────────────────────────────────────────────────────────────────

alter table candidates add column headline text;
