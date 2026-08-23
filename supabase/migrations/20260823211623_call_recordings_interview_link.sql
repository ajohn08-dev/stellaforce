-- Close the loop: the ElevenLabs post-call webhook can now attach its artifact
-- to the booking that caused it.
--
-- Nullable, because the two existing call paths have no booking behind them —
-- the Agents page test run (`is_test = true`) and the browser interview room.
alter table public.call_recordings
  add column interview_id uuid references public.interviews(id) on delete set null;

create index idx_call_recordings_interview on public.call_recordings (interview_id);

comment on column public.call_recordings.interview_id is
  'The booked interview this recording came from. Null for test runs and browser '
  'interview-room sessions, which have no scheduling request behind them.';
