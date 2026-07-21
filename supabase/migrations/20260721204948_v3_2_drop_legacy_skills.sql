-- ─────────────────────────────────────────────────────────────────────────────
-- V3.2 — Drop legacy skills table/enums after verifying the migration
-- (16 legacy rows -> 16 candidate_skills rows, 12 distinct names -> 12 skills
-- rows, confirmed before running this).
-- ─────────────────────────────────────────────────────────────────────────────

drop table legacy_skills;
drop type legacy_skill_type;
drop type legacy_proficiency_level;
