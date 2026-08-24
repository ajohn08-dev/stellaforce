-- Widen booking from "an agent" to "whoever runs this stage".
--
-- The rule `send_booking_link` said *AI interview with an agent assigned*, and
-- the substrate meant it: `agent_id` was NOT NULL on a scheduling request, both
-- exclusion constraints keyed on it, and confirm always queued an agent call. A
-- human interview could not be booked at all.
--
-- Two bookable resources now, and exactly one per booking:
--   an **agent**       — capacity N (its concurrent-call limit), lane-indexed
--   an **interviewer** — capacity 1, because a person does one interview at a time
--
-- Panels are still out. `job_workflow_sub_stage_reviewers` has no
-- required-vs-optional flag, so "whose calendar counts" has no answer in the
-- schema yet; a stage with more than one reviewer resolves as not-applicable
-- rather than guessing.

-- ── Where a human interviewer is free ───────────────────────────────────────
-- Busy time comes live from Google (`getCalendarPreview`). What Google cannot
-- say is when someone is *willing* to be booked — that lived in React state on
-- the availability sheet and reset on reload, which
-- `docs/google-calendar-consent-plan.md` already named as the next step.
-- Nullable: absent falls back to the stage's operating window, so an interviewer
-- who has set nothing is still bookable.
alter table public.job_team_members
  add column timezone            text,
  add column working_hours_start smallint check (working_hours_start between 0 and 23),
  add column working_hours_end   smallint check (working_hours_end   between 1 and 24),
  add column preferred_days      smallint[],
  add constraint jtm_hours_ordered
    check (working_hours_end is null or working_hours_start is null
           or working_hours_end > working_hours_start);

comment on column public.job_team_members.timezone is
  'IANA zone this person''s working hours are expressed in. Null falls back to '
  'the stage''s operating timezone.';

-- ── Requests: agent OR interviewer ──────────────────────────────────────────
alter table public.interview_scheduling_requests
  alter column agent_id drop not null;

alter table public.interview_scheduling_requests
  add column interviewer_member_id uuid references public.job_team_members(id) on delete restrict;

alter table public.interview_scheduling_requests
  add constraint isr_one_resource
    check (num_nonnulls(agent_id, interviewer_member_id) = 1);

create index idx_isr_interviewer on public.interview_scheduling_requests (interviewer_member_id);

comment on constraint isr_one_resource on public.interview_scheduling_requests is
  'Exactly one bookable resource. An agent interview queues a call; an '
  'interviewer interview books a person''s calendar. Never both, never neither.';

-- ── Interviews + holds: a second reservation key ────────────────────────────
-- A person has no lanes, so no slot index: capacity is 1 and the constraint says
-- so directly. Deliberately a separate constraint rather than a generic
-- `resource_id`, because the two resources genuinely differ — one is N-capacity
-- and lane-indexed, the other is not — and collapsing them would have meant
-- storing a fake lane 0 for every human booking.
alter table public.interviews
  add column interviewer_member_id uuid references public.job_team_members(id) on delete restrict;

alter table public.interviews
  add constraint interviews_no_interviewer_overlap
    exclude using gist (
      interviewer_member_id with =,
      during                with &&
    ) where (interviewer_member_id is not null
             and status in ('scheduled', 'in_progress'));

create index idx_interviews_interviewer_window
  on public.interviews (interviewer_member_id, scheduled_at)
  where status in ('scheduled', 'in_progress');

alter table public.interview_slot_holds
  alter column agent_id drop not null,
  alter column agent_slot_index drop not null;

alter table public.interview_slot_holds
  add column interviewer_member_id uuid references public.job_team_members(id) on delete cascade;

alter table public.interview_slot_holds
  add constraint holds_one_resource
    check (num_nonnulls(agent_id, interviewer_member_id) = 1),
  -- An agent hold still needs its lane; an interviewer hold must not carry one.
  add constraint holds_agent_has_lane
    check ((agent_id is null) = (agent_slot_index is null));

alter table public.interview_slot_holds
  add constraint holds_no_interviewer_overlap
    exclude using gist (
      interviewer_member_id with =,
      during                with &&
    ) where (interviewer_member_id is not null);

create index idx_holds_interviewer on public.interview_slot_holds (interviewer_member_id);

-- `scheduled_agent_calls` is untouched and stays agent-only, on purpose: a human
-- interview must never queue a bot to dial the candidate. n8n writes a calendar
-- event for those instead.
