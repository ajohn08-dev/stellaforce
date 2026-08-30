-- Publishing the Sales Executive job: the writes `publishJob` performs.

-- ── 5. Snapshot the template into the job ─────────────────────────────────
-- Mirrors `snapshotRowFromTemplateStage`. `questions` and `owner_member_id`
-- have no template counterpart and are set separately below.
insert into public.job_workflow_sub_stages (
  job_id, pipeline_stage_id, name, purpose, duration_minutes, format,
  visibility, owner_role, collaborator_role, entry_conditions, interviewer_type,
  question_source, required_questions, capture_feedback_form, capture_transcript,
  decision_mode, decision_owner, rating_scale, hire_recommendation_enabled,
  override_enabled, override_roles, allowed_outcomes, needs_final_approval,
  display_order, config, agent_id, scheduling_mode
)
select
  '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92',
  s.pipeline_stage_id, s.name, s.purpose, s.duration_minutes, s.format,
  s.visibility, s.owner_role, s.collaborator_role, s.entry_conditions, s.interviewer_type,
  s.question_source, s.required_questions, s.capture_feedback_form, s.capture_transcript,
  s.decision_mode, s.decision_owner, s.rating_scale, s.hire_recommendation_enabled,
  s.override_enabled, s.override_roles, s.allowed_outcomes, s.needs_final_approval,
  s.display_order, s.config, s.agent_id, s.scheduling_mode
from public.workflow_template_sub_stages s
where s.template_id = '7a1c9e40-52d8-4b6f-8c93-1e4a7d05b2c6'
  and not exists (
    select 1 from public.job_workflow_sub_stages j
    where j.job_id = '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92'
  );

-- Stage ownership. The Sales Director owns the rounds he runs.
update public.job_workflow_sub_stages
set owner_member_id = case
  when name in ('Hiring Manager Interview', 'Executive Round')
    then 'c2000000-0000-4000-8000-000000000001'::uuid
  else 'c2000000-0000-4000-8000-000000000002'::uuid
end
where job_id = '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92';

-- ── 6a. Competencies per evaluative stage — publishJob's first gate ───────
insert into public.job_workflow_sub_stage_competencies (sub_stage_id, competency_id)
select s.id, c.competency_id::uuid
from public.job_workflow_sub_stages s
join public.pipeline_stages ps on ps.id = s.pipeline_stage_id
join (values
  ('Pre-Screening',            'a1000000-0000-4000-8000-000000000001'),
  ('Pre-Screening',            'a1000000-0000-4000-8000-000000000003'),
  ('Recruiter Screen',         'a1000000-0000-4000-8000-000000000003'),
  ('Hiring Manager Interview', 'a1000000-0000-4000-8000-000000000001'),
  ('Hiring Manager Interview', 'a1000000-0000-4000-8000-000000000003'),
  ('Who Interview',            'a1000000-0000-4000-8000-000000000004'),
  ('Case Study Interview',     'a1000000-0000-4000-8000-000000000002'),
  ('Case Study Interview',     'a1000000-0000-4000-8000-000000000004'),
  ('Executive Round',          'a1000000-0000-4000-8000-000000000005')
) as c(stage_name, competency_id) on c.stage_name = s.name
where s.job_id = '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92'
  and ps.key::text in ('screen', 'interview')
on conflict do nothing;

-- ── 6b. Exactly one reviewer per evaluative stage ─────────────────────────
-- One, not "at least one": two reviewers resolve as `panel_not_supported`,
-- because `job_workflow_sub_stage_reviewers` has no required-vs-optional flag.
insert into public.job_workflow_sub_stage_reviewers (sub_stage_id, member_id)
select s.id,
  case when s.name in ('Hiring Manager Interview', 'Executive Round')
    then 'c2000000-0000-4000-8000-000000000001'::uuid
    else 'c2000000-0000-4000-8000-000000000002'::uuid
  end
from public.job_workflow_sub_stages s
join public.pipeline_stages ps on ps.id = s.pipeline_stage_id
where s.job_id = '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92'
  and ps.key::text in ('screen', 'interview')
on conflict do nothing;

-- ── 7. Freeze the settings cascade at job scope ───────────────────────────
-- publishJob writes the *resolved* values so a published job is self-contained.
-- With only the seeded globals present, resolving is the same as copying them.
insert into public.workflow_settings (scope, scope_id, client_id, category, config)
select 'job', '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92', 'c1e0f4a2-6d3b-4f8e-9a17-2b5c8d0e7f31', w.category, w.config
from public.workflow_settings w
where w.scope = 'global'
on conflict do nothing;

insert into public.sla_policies (scope, scope_id, client_id, sla_type, threshold_hours, enabled, config)
select 'job', '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92', 'c1e0f4a2-6d3b-4f8e-9a17-2b5c8d0e7f31',
       p.sla_type, p.threshold_hours, p.enabled, p.config
from public.sla_policies p
where p.scope = 'global'
on conflict do nothing;

insert into public.communication_templates (scope, scope_id, client_id, trigger_event_type, channel, subject, body, recipients, enabled)
select 'job', '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92', 'c1e0f4a2-6d3b-4f8e-9a17-2b5c8d0e7f31',
       t.trigger_event_type, t.channel, t.subject, t.body, t.recipients, t.enabled
from public.communication_templates t
where t.scope = 'global'
on conflict do nothing;

-- ── 8. Open for business ──────────────────────────────────────────────────
update public.job_orders
set status = 'open',
    workflow_template_id = '7a1c9e40-52d8-4b6f-8c93-1e4a7d05b2c6',
    workflow_template_version = (select version from public.workflow_templates where id = '7a1c9e40-52d8-4b6f-8c93-1e4a7d05b2c6')
where job_id = '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92';
