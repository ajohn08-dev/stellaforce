-- A screening agent for the Product Designer role, and the first row anywhere
-- to actually set `job_workflow_sub_stages.agent_id`.
--
-- The id is written explicitly rather than defaulted. The agent's prompt and
-- questions live in `src/lib/interview-agent-config.ts`, keyed by this uuid, so
-- a generated id would mean the code key and the row could only be reconciled
-- by hand after the fact — and would differ per environment.
--
-- `external_agent_id` stays null here; the follow-up migration points it at the
-- one ElevenLabs agent this workspace has. Assigning the agent to a stage does
-- NOT by itself make that stage self-scheduling — but note `scheduling_mode`
-- NULL *inherits the cascade*, and `workflow_settings` carries
-- `candidate_self_scheduling` at global scope, so this stage was already
-- self-scheduling and was only missing an agent.
insert into public.agents (id, name, description, status, provider, avg_handle_time_minutes)
values (
  '5c63f255-b827-45f1-bdbc-74a5a03ded04',
  'Product Designer Screening Agent',
  'First-pass screen for product design applicants: portfolio depth, craft, and how they work with engineering and research before a recruiter reviews the file.',
  'active',
  'elevenlabs',
  6
)
on conflict (id) do nothing;

-- Attach it to the Product Designer job's Pre-Screening sub-stage, which is
-- already `interviewer_type = 'ai'` and `format = 'phone'`. Matched by name
-- within the job rather than by stage id so this is a no-op, not a failure, in
-- any environment where that pipeline differs.
update public.job_workflow_sub_stages
set agent_id = '5c63f255-b827-45f1-bdbc-74a5a03ded04'
where job_id = '308f4d06-8b28-4d3f-b824-e93ecde00db7'
  and name = 'Pre-Screening'
  and interviewer_type = 'ai';
