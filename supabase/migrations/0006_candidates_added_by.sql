-- ─────────────────────────────────────────────────────────────────────────────
-- 0006 — candidates.added_by (attribution: which recruiter/manager/admin
-- added this candidate). Nullable — historical rows and any service-role
-- writes without an acting user stay valid; app write paths should always
-- set it going forward.
-- ─────────────────────────────────────────────────────────────────────────────

alter table candidates
  add column added_by uuid references profiles(id) on delete set null;

create index idx_candidates_added_by on candidates(added_by);
