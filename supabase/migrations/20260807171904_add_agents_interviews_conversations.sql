-- New enums
create type agent_status as enum ('active', 'inactive');
create type interview_status as enum ('scheduled', 'completed', 'canceled', 'no_show');
create type transcript_status as enum ('pending', 'processing', 'completed', 'failed');

-- agents: minimal registry for externally-hosted (e.g. ElevenLabs) screening agents
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status agent_status not null default 'active',
  -- Free text, not an enum: an evolving external-integration detail
  -- (which voice/AI platform runs the agent), not a fixed domain vocabulary.
  provider text not null,
  external_agent_id text,
  avg_handle_time_minutes numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_agents_updated before update on public.agents
  for each row execute function set_updated_at();

alter table public.agents enable row level security;
create policy "read_agents" on public.agents for select to authenticated using (true);
create policy "stellaforce_write_agents" on public.agents for all to authenticated
  using (current_profile_side() = 'stellaforce') with check (current_profile_side() = 'stellaforce');

-- interviews: job-side source of truth, one row per interview/screening instance,
-- human or AI conducted, always tied to a real application + sub-stage.
-- NOTE: superseded by the 20260807173038_reconcile_call_recordings_with_agents
-- migration below, which drops this table in favor of extending the
-- already-live call_recordings table instead. Kept here for migration history.
create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(application_id),
  sub_stage_id uuid not null references public.job_workflow_sub_stages(id),
  client_id uuid not null references public.clients(client_id), -- denormalized for RLS
  evaluation_id uuid references public.application_stage_evaluations(id),
  status interview_status not null default 'scheduled',
  interviewer_type interviewer_type not null default 'human',
  interviewer_id uuid references public.job_team_members(id), -- when human/external
  agent_id uuid references public.agents(id),                 -- when ai
  scheduled_at timestamptz,
  started_at timestamptz,
  duration_seconds int4,
  format stage_format, -- reuse existing enum (phone|video|onsite|async)
  transcript jsonb,     -- [{ speaker: text, text: text, at?: text }, ...]
  transcript_status transcript_status not null default 'pending',
  audio_url text,
  video_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interviews_transcript_required_when_completed
    check (status <> 'completed' or transcript is not null)
);
create index idx_interviews_application on public.interviews(application_id);
create index idx_interviews_sub_stage on public.interviews(sub_stage_id);
create trigger trg_interviews_updated before update on public.interviews
  for each row execute function set_updated_at();

alter table public.interviews enable row level security;
create policy "tenant_read_interviews" on public.interviews for select to authenticated
  using (current_profile_side() = 'stellaforce' or client_id = current_profile_client_id());
create policy "tenant_write_interviews" on public.interviews for all to authenticated
  using (current_profile_side() = 'stellaforce' or client_id = current_profile_client_id())
  with check (current_profile_side() = 'stellaforce' or client_id = current_profile_client_id());

-- conversations: agent-only raw ingestion log from the ElevenLabs post-call webhook.
-- NOTE: also superseded/dropped by the reconcile migration below.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id), -- always set: agent-only log
  interview_id uuid references public.interviews(id),  -- set for real candidate screens
  client_id uuid references public.clients(client_id),  -- null for test calls
  candidate_id uuid references public.candidates(candidate_id), -- denormalized, null for test calls
  job_id uuid references public.job_orders(job_id),              -- denormalized, null for test calls
  is_test boolean not null default false,
  to_number text,
  campaign_id uuid,
  elevenlabs_conversation_id text unique not null, -- idempotency key from the ElevenLabs callback
  call_status text,       -- ElevenLabs' own call-state vocabulary, stored as-received
  call_successful text,   -- ElevenLabs' own outcome classification, stored as-received
  title text,
  summary text,
  termination_reason text,
  started_at timestamptz not null default now(),
  duration_seconds int4,
  transcript jsonb,       -- structured turns, always populated once the call ends
  transcript_text text,   -- flattened plain text, for search/display
  audio_storage_path text,     -- Supabase Storage path, e.g. "conversations/{id}/recording.mp3"
  audio_mime_type text,
  audio_uploaded_at timestamptz,
  video_url text,          -- video-capable stages only; plain link, not owned like audio
  raw_elevenlabs_payload jsonb, -- full webhook body, for audit/replay/debugging
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_real_calls_need_interview
    check (is_test or interview_id is not null)
);
create index idx_conversations_agent on public.conversations(agent_id);
create index idx_conversations_interview on public.conversations(interview_id);
create trigger trg_conversations_updated before update on public.conversations
  for each row execute function set_updated_at();

alter table public.conversations enable row level security;
create policy "tenant_read_conversations" on public.conversations for select to authenticated
  using (current_profile_side() = 'stellaforce' or client_id = current_profile_client_id());
create policy "tenant_write_conversations" on public.conversations for all to authenticated
  using (current_profile_side() = 'stellaforce' or client_id = current_profile_client_id())
  with check (current_profile_side() = 'stellaforce' or client_id = current_profile_client_id());

-- Let a workflow stage/template specify which agent conducts it, same as interviewer_type
alter table public.job_workflow_sub_stages add column agent_id uuid references public.agents(id);
alter table public.workflow_template_sub_stages add column agent_id uuid references public.agents(id);
