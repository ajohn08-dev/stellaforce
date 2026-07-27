-- ─────────────────────────────────────────────────────────────────────────────
-- Case-insensitive dedup for the global `skills`/`tools` lookup tables.
--
-- n8n's resume-ingestion LLM has no controlled vocabulary constraint on skill/
-- tool names (unlike the paste-text AI tab, which steers Claude toward
-- SKILL_TAXONOMY), so the same real-world skill can arrive under different
-- casing across resumes ("Python" vs "python") and previously became two
-- separate rows instead of reusing the existing one. This migration:
--   1. Collapses existing case-variant duplicates (keeping the oldest row as
--      canonical), repointing any candidate_skills/candidate_tools rows that
--      referenced a duplicate onto the canonical id first.
--   2. Replaces the plain unique(name) constraint with a case-insensitive
--      unique index on lower(name), so this can't happen again — even under
--      concurrent ingestion requests.
-- ─────────────────────────────────────────────────────────────────────────────

-- (1) skills --------------------------------------------------------------------

create temporary table skill_dupe_map as
with ranked as (
  select id, lower(name) as name_ci, created_at,
         row_number() over (partition by lower(name) order by created_at, id) as rn
  from skills
)
select r.id as dupe_id, c.id as canonical_id
from ranked r
join ranked c on c.name_ci = r.name_ci and c.rn = 1
where r.rn > 1;

-- Drop any candidate_skills link that would collide with one the candidate
-- already has on the canonical skill once we repoint (would violate
-- unique(candidate_id, skill_id)).
delete from candidate_skills cs
using skill_dupe_map m
where cs.skill_id = m.dupe_id
  and exists (
    select 1 from candidate_skills cs2
    where cs2.candidate_id = cs.candidate_id and cs2.skill_id = m.canonical_id
  );

update candidate_skills cs
set skill_id = m.canonical_id
from skill_dupe_map m
where cs.skill_id = m.dupe_id;

delete from skills s using skill_dupe_map m where s.id = m.dupe_id;

drop table skill_dupe_map;

alter table skills drop constraint skills_name_key;
create unique index skills_name_ci_key on skills (lower(name));

-- (2) tools -----------------------------------------------------------------------

create temporary table tool_dupe_map as
with ranked as (
  select id, lower(name) as name_ci, created_at,
         row_number() over (partition by lower(name) order by created_at, id) as rn
  from tools
)
select r.id as dupe_id, c.id as canonical_id
from ranked r
join ranked c on c.name_ci = r.name_ci and c.rn = 1
where r.rn > 1;

delete from candidate_tools ct
using tool_dupe_map m
where ct.tool_id = m.dupe_id
  and exists (
    select 1 from candidate_tools ct2
    where ct2.candidate_id = ct.candidate_id and ct2.tool_id = m.canonical_id
  );

update candidate_tools ct
set tool_id = m.canonical_id
from tool_dupe_map m
where ct.tool_id = m.dupe_id;

delete from tools t using tool_dupe_map m where t.id = m.dupe_id;

drop table tool_dupe_map;

alter table tools drop constraint tools_name_key;
create unique index tools_name_ci_key on tools (lower(name));
