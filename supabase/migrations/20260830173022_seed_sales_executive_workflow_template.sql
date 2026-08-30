-- The Sales Executive hiring workflow: nine stages, two of them run by agents.
--
-- Global (`client_id` null), so it is offered on every job rather than only
-- Stellaforce's. Field defaults mirror what `saveTemplateSubStages`
-- (src/app/(app)/workflows/actions.ts) applies when the Stages tab saves, so a
-- template seeded here and one authored in the UI are the same shape.
--
-- `display_order` is the position **within** a Tier-1 stage, not across the
-- pipeline — five sub-stages sharing 0 is correct. Ordering is
-- (pipeline_stages.display_order, this).
insert into public.workflow_templates (id, name, description, client_id, status, version)
values (
  '7a1c9e40-52d8-4b6f-8c93-1e4a7d05b2c6',
  'Sales Executive Hiring Workflow',
  'Nine-stage go-to-market pipeline: AI pre-screen, recruiter screen, hiring manager, Who interview, case study, executive round.',
  null,
  'published',
  1
)
on conflict (id) do nothing;

insert into public.workflow_template_sub_stages (
  template_id, pipeline_stage_id, name, purpose, display_order,
  interviewer_type, agent_id, format, duration_minutes,
  visibility, entry_conditions, question_source,
  capture_feedback_form, capture_transcript,
  decision_mode, rating_scale, hire_recommendation_enabled,
  override_enabled, allowed_outcomes, needs_final_approval, config
)
select
  '7a1c9e40-52d8-4b6f-8c93-1e4a7d05b2c6',
  ps.id,
  v.name, v.purpose, v.display_order,
  v.interviewer_type::interviewer_type,
  v.agent_id::uuid,
  v.format::stage_format,
  v.duration_minutes,
  'internal'::stage_visibility,
  array['automatic','manual']::stage_entry_condition[],
  case when v.evaluative then 'structured'::question_source else null end,
  v.evaluative, v.evaluative,
  'single_rater'::decision_mode,
  case when v.evaluative then 'ten-point'::rating_scale else null end,
  v.stage_key = 'offer',
  false,
  '{}'::text[],
  v.stage_key = 'offer',
  '{}'::jsonb
from (values
  ('source',    'Sourced',                  'Candidates identified and added to the pipeline.',                         0, 'human', null,                                   null,    null,  false),
  ('screen',    'Pre-Screening',            'AI phone screen: location, work authorization, and sales-tech depth.',      0, 'ai',    '2f8b6c14-9a37-4d05-b8e2-6c1f39a4d708', 'phone', 15,    true),
  ('screen',    'Recruiter Screen',         'Recruiter call: motivation, compensation, and logistics.',                  1, 'human', null,                                   'phone', 30,    true),
  ('interview', 'Hiring Manager Interview', 'Sales Director: territory ownership, pipeline discipline, quota history.',  0, 'human', null,                                   'video', 45,    true),
  ('interview', 'Who Interview',            'Structured career-history interview run by an agent.',                      1, 'ai',    '8490ea4c-ad8f-4f25-a0f7-74ff7e50b737', 'video', 45,    true),
  ('interview', 'Case Study Interview',     'Live mid-market deal case: discovery, multi-stakeholder plan, close.',      2, 'human', null,                                   'video', 60,    true),
  ('interview', 'Executive Round',          'Executive conversation: judgement, market view, long-term fit.',            3, 'human', null,                                   'video', 30,    true),
  ('offer',     'Offer',                    'Offer construction and approval.',                                          0, 'human', null,                                   null,    null,  false),
  ('close',     'Close',                    'Acceptance, start date, and handover.',                                     0, 'human', null,                                   null,    null,  false)
) as v(stage_key, name, purpose, display_order, interviewer_type, agent_id, format, duration_minutes, evaluative)
join public.pipeline_stages ps on ps.key::text = v.stage_key
on conflict do nothing;
