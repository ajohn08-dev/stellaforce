-- ─────────────────────────────────────────────────────────────────────────────
-- V3.2 — profiles: role becomes nullable (null for client-side profiles).
-- Preserves 0007's existing requirement that client_id/client_role are set
-- only for side='client', while adding the new role-nullability requirement.
-- Only 1 live profile row at migration time (side='stellaforce', role='admin'),
-- verified to satisfy the new constraint before/after.
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles alter column role drop not null;
alter table profiles alter column role drop default;

alter table profiles drop constraint chk_profiles_side_consistency;

alter table profiles add constraint chk_profiles_side_consistency check (
  (side = 'stellaforce' and role is not null and client_role is null and client_id is null)
  or
  (side = 'client' and role is null and client_role is not null and client_id is not null)
);
