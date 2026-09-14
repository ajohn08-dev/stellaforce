-- Anna John, sourced on the Sales Executive job.
--
-- `applications` is unique on (candidate_id, job_id), so her existing Product
-- Designer application is untouched — she now has two, which is the point: the
-- demo needs a candidate who exists on more than one pipeline.
insert into public.applications (
  application_id, candidate_id, job_id, client_id, current_stage_id, status, date_applied
)
select
  'e3000000-0000-4000-8000-000000000001',
  '0a808152-3843-4ba9-aae9-30c5be05874b',
  '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92',
  'c1e0f4a2-6d3b-4f8e-9a17-2b5c8d0e7f31',
  s.id,
  'active',
  now()
from public.job_workflow_sub_stages s
where s.job_id = '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92' and s.name = 'Sourced'
on conflict (candidate_id, job_id) do nothing;

-- The open history row: entered Sourced, never left. `moveApplicationToStage`
-- closes this one when she advances.
insert into public.application_stage_history (application_id, sub_stage_id, entered_at)
select 'e3000000-0000-4000-8000-000000000001', s.id, now()
from public.job_workflow_sub_stages s
where s.job_id = '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92' and s.name = 'Sourced'
  and not exists (
    select 1 from public.application_stage_history h
    where h.application_id = 'e3000000-0000-4000-8000-000000000001'
  );

insert into public.activity_events (
  event_type, client_id, candidate_id, job_id, application_id, sub_stage_id,
  actor_type, system_source, severity, idempotency_key
)
select
  'application_created', 'c1e0f4a2-6d3b-4f8e-9a17-2b5c8d0e7f31',
  '0a808152-3843-4ba9-aae9-30c5be05874b', '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92',
  'e3000000-0000-4000-8000-000000000001', s.id,
  'system', 'seed:sales_executive', 'info',
  'application_created:e3000000-0000-4000-8000-000000000001'
from public.job_workflow_sub_stages s
where s.job_id = '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92' and s.name = 'Sourced'
on conflict (idempotency_key) do nothing;
