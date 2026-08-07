-- Reconcile: drop the separate interviews/conversations design in favor of
-- extending the already-live call_recordings table (built independently,
-- same session) with the ElevenLabs post-call fields. agents table already
-- exists from the prior migration and is kept as-is.
drop table if exists public.conversations;
drop table if exists public.interviews;
drop type if exists interview_status;
drop type if exists transcript_status;

-- call_recordings: rename existing plain-text transcript to transcript_text,
-- add a structured jsonb transcript, and add agent/candidate/job/campaign
-- linkage + the ElevenLabs post-call payload fields.
alter table public.call_recordings rename column transcript to transcript_text;

alter table public.call_recordings
  add column agent_id uuid references public.agents(id),
  add column sub_stage_id uuid references public.job_workflow_sub_stages(id),
  add column client_id uuid references public.clients(client_id),
  add column candidate_id uuid references public.candidates(candidate_id),
  add column job_id uuid references public.job_orders(job_id),
  add column campaign_id uuid,
  add column to_number text,
  add column elevenlabs_conversation_id text unique,
  add column call_status text,
  add column call_successful text,
  add column title text,
  add column summary text,
  add column termination_reason text,
  add column started_at timestamptz,
  add column transcript jsonb,
  add column video_url text,
  add column raw_elevenlabs_payload jsonb,
  add constraint call_recordings_test_calls_need_agent
    check (not is_test or agent_id is not null);

create index idx_call_recordings_agent on public.call_recordings(agent_id);
create index idx_call_recordings_sub_stage on public.call_recordings(sub_stage_id);

-- Replace the permissive authenticated-ALL policy with tenant-scoped read/write,
-- matching ai_interactions — these rows hold candidate PII + AI-conducted content.
drop policy "call_recordings: authenticated read/write" on public.call_recordings;
alter table public.call_recordings enable row level security;
create policy "tenant_read_call_recordings" on public.call_recordings for select to authenticated
  using (current_profile_side() = 'stellaforce' or client_id = current_profile_client_id());
create policy "tenant_write_call_recordings" on public.call_recordings for all to authenticated
  using (current_profile_side() = 'stellaforce' or client_id = current_profile_client_id())
  with check (current_profile_side() = 'stellaforce' or client_id = current_profile_client_id());
