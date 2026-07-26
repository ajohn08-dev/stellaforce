-- ─────────────────────────────────────────────────────────────────────────────
-- V3.2 — Restructure skills into a global lookup + candidate_skills junction
--
-- Was: `skills` was a per-candidate row (skill_id pk, candidate_id fk,
-- skill_name free text). Now: `skills`/`tools` are global, deduplicated
-- lookups shared across candidates, with per-candidate assignment living in
-- `candidate_skills`/`candidate_tools`.
--
-- skill_type values changed hard|soft -> technical|functional|behavioral.
-- Live data mapping (confirmed): hard -> technical, soft -> behavioral.
-- proficiency_level dropped the unused 'novice' value (0 rows used it).
-- ─────────────────────────────────────────────────────────────────────────────

alter table skills rename to legacy_skills;
alter type skill_type rename to legacy_skill_type;
alter type proficiency_level rename to legacy_proficiency_level;

create type skill_type as enum ('technical', 'functional', 'behavioral');
create type proficiency_level as enum ('beginner', 'intermediate', 'advanced', 'expert');

create table skills (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  skill_type skill_type not null,
  category   text,
  created_at timestamptz not null default now()
);

create table tools (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  category   text,
  created_at timestamptz not null default now()
);

create table candidate_skills (
  id                  uuid primary key default gen_random_uuid(),
  candidate_id        uuid not null references candidates(candidate_id) on delete cascade,
  skill_id            uuid not null references skills(id) on delete restrict,
  proficiency_level   proficiency_level not null,
  years_of_experience integer,
  assessment_score    numeric(5,2),
  scorecard           jsonb,
  ai_literacy_signal  jsonb,
  created_at          timestamptz not null default now()
);

create table candidate_tools (
  id                uuid primary key default gen_random_uuid(),
  candidate_id      uuid not null references candidates(candidate_id) on delete cascade,
  tool_id           uuid not null references tools(id) on delete restrict,
  proficiency_level proficiency_level,
  created_at        timestamptz not null default now()
);

insert into skills (name, skill_type, created_at)
select distinct on (skill_name)
  skill_name,
  case skill_type when 'hard' then 'technical'::skill_type else 'behavioral'::skill_type end,
  now()
from legacy_skills
order by skill_name, created_at;

insert into candidate_skills (
  candidate_id, skill_id, proficiency_level, assessment_score, scorecard,
  ai_literacy_signal, created_at
)
select
  ls.candidate_id,
  s.id,
  ls.proficiency_level::text::proficiency_level,
  ls.assessment_score,
  ls.scorecard,
  ls.ai_literacy_signal,
  ls.created_at
from legacy_skills ls
join skills s on s.name = ls.skill_name;
