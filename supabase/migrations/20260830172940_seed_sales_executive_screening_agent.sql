-- The pre-screen agent for Sales Executive roles.
--
-- The id is written explicitly: `src/lib/interview-agent-config.ts` keys this
-- agent's prompt and questions off it, so a generated id would have to be
-- reconciled with the code by hand and would differ per environment.
--
-- `external_agent_id` is the one ElevenLabs agent this workspace has, shared by
-- every row here. What differs per screen is the prompt override, which the
-- config file builds — see `buildInterviewPrompt`.
insert into public.agents (id, name, description, status, provider, external_agent_id, avg_handle_time_minutes)
values (
  '2f8b6c14-9a37-4d05-b8e2-6c1f39a4d708',
  'Sales Executive Screening Agent',
  'First-pass screen for go-to-market applicants: Charleston-based, work authorization, and depth of B2B mid-market sales-tech experience.',
  'active',
  'elevenlabs',
  'agent_8301ky17agdveats253z9hw5f106',
  6
)
on conflict (id) do nothing;
