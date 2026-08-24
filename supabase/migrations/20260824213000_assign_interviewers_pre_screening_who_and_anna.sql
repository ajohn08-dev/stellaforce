-- Who runs each stage, on the default workflow and on the live Product Designer
-- job. These are two separate writes on purpose: a template is **snapshotted**
-- into a job at publish, so editing the template never reaches a job that is
-- already running, and editing the job never reaches the next one. Both are
-- needed, and neither is a substitute for the other.

-- ── The default workflow, for jobs published from here on ──────────────────
-- `interviewer_type` was already right on this template (Pre-Screening and Who
-- Interview `ai`, the rest `human`); what was missing everywhere was *which*
-- agent. The template can only name agents: interviewers are people on a
-- specific job (`job_team_members`), so a template has nowhere to put one.
update public.workflow_template_sub_stages
set agent_id = 'ad106fe1-3bb7-498a-bc98-a699d7870b20'  -- Generalist Recruiter Screen
where template_id = '0e846998-8d52-4daf-9591-7f5c3e90b5ca'
  and name = 'Pre-Screening'
  and interviewer_type = 'ai';

update public.workflow_template_sub_stages
set agent_id = '8490ea4c-ad8f-4f25-a0f7-74ff7e50b737'  -- Who Interview
where template_id = '0e846998-8d52-4daf-9591-7f5c3e90b5ca'
  and name = 'Who Interview'
  and interviewer_type = 'ai';

-- ── The live Product Designer job ─────────────────────────────────────────
-- Pre-Screening already runs the Product Designer Screening Agent, which is
-- role-specific and deliberately *not* what the generic template carries.
update public.job_workflow_sub_stages
set agent_id = '8490ea4c-ad8f-4f25-a0f7-74ff7e50b737'  -- Who Interview
where job_id = '308f4d06-8b28-4d3f-b824-e93ecde00db7'
  and name = 'Who Interview'
  and interviewer_type = 'ai';

-- Anna John is the interviewer on the five human stages. Recruiter Screen and
-- Panel Interview each carried a second reviewer, and two reviewers resolve as
-- `panel_not_supported` — `job_workflow_sub_stage_reviewers` has no
-- required-vs-optional flag, so "whose calendar counts" has no answer in the
-- schema. Leaving the second name would make both stages unbookable rather than
-- shared.
delete from public.job_workflow_sub_stage_reviewers r
using public.job_workflow_sub_stages s
where r.sub_stage_id = s.id
  and s.job_id = '308f4d06-8b28-4d3f-b824-e93ecde00db7'
  and s.name in (
    'Recruiter Screen', 'HR Interview', 'Hiring Manager Interview',
    'Technical Interview', 'Panel Interview'
  )
  and r.member_id <> 'bb5705e3-9958-479a-abd3-d1af0115a713';

insert into public.job_workflow_sub_stage_reviewers (sub_stage_id, member_id)
select s.id, 'bb5705e3-9958-479a-abd3-d1af0115a713'
from public.job_workflow_sub_stages s
where s.job_id = '308f4d06-8b28-4d3f-b824-e93ecde00db7'
  and s.name in (
    'Recruiter Screen', 'HR Interview', 'Hiring Manager Interview',
    'Technical Interview', 'Panel Interview'
  )
on conflict do nothing;
