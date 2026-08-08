-- Seed the screening agents that the Agents page previously rendered from
-- src/lib/mock-agents.ts, so call_recordings.agent_id has real rows to
-- reference. `external_agent_id` (the agent's id on the voice platform) is
-- left null until each is actually created in ElevenLabs — only agents with
-- one set can place a real call.
insert into public.agents (name, description, status, provider, avg_handle_time_minutes)
values
  ('Engineering First-Pass Screen',
   'Screens engineering applicants against role fundamentals and years of experience before a recruiter touches the file.',
   'active', 'elevenlabs', 4),
  ('Sales AE Qualifier',
   'Confirms quota-carrying experience and territory fit for account executive applicants ahead of the live role-play stage.',
   'active', 'elevenlabs', 3),
  ('Generalist Recruiter Screen',
   'Baseline availability, compensation, and location screen reused across roles without a specialized agent.',
   'active', 'elevenlabs', 5),
  ('Executive Search Pre-Screen',
   'Confirms scope, motivation, and comp expectations for VP+ candidates before the board-style panel.',
   'inactive', 'elevenlabs', 8),
  ('Data & Analytics Screen',
   'SQL fluency and case-study readiness check for data engineer and analyst applicants.',
   'active', 'elevenlabs', 6),
  ('CSM Onboarding Screen',
   'Lightweight availability and customer-facing experience check for customer success manager applicants.',
   'inactive', 'elevenlabs', 2)
on conflict do nothing;
