-- The 14th automation definition, and the first one that actually runs.
--
-- Key is `send_booking_link` — bare, matching the 13 existing keys, not the
-- dotted `scheduling.send_booking_link` the brief suggested. Its trigger is
-- `candidate_added_to_stage`, which is ALSO the trigger of the definition of the
-- same name. That is not a collision: `automation_definitions.key` was made a
-- separate column from `trigger_event_type` precisely so two rules can hang off
-- one trigger, and this is the first case.
--
-- The two are genuinely different rules. `candidate_added_to_stage` is the broad
-- lifecycle rule (assign the owner, start the SLA clock, compile agent context).
-- `send_booking_link` fires only on a stage that is an AI interview with an
-- agent assigned, `automatic` entry, and scheduling_mode =
-- 'candidate_self_scheduling' — a gate specific enough that pausing it stops
-- booking links without stopping stage entry itself.
insert into automation_definitions (key, name, trigger_event_type, category)
values (
  'send_booking_link',
  'Send interview booking link',
  'candidate_added_to_stage',
  'scheduling'
)
on conflict (key) where client_id is null do nothing;

insert into automation_definition_versions (
  definition_id, version, status, published_at,
  condition_text, actions, tasks_and_reminders, exceptions, sla_type, default_mode
)
select d.id, 1, 'published', now(),
  $c$The stage is an AI interview with an agent assigned, entered automatically, and set to candidate self-scheduling.$c$,
  $j$[{"key":"create_scheduling_request","label":"Create a scheduling request and a single-use booking link"},
      {"key":"send_booking_link","label":"Send the candidate their booking link"},
      {"key":"queue_agent_call","label":"Queue the agent's call for the time the candidate picks"}]$j$::jsonb,
  $j$[{"key":"expiry_sweep","label":"Flag the recruiter if the link expires unbooked"}]$j$::jsonb,
  $j$[{"key":"no_bookable_slot","label":"No slot inside the booking horizon — raise a scheduling exception"},
      {"key":"agent_capacity_unavailable","label":"The agent is at capacity — raise a scheduling exception"},
      {"key":"call_start_failed","label":"The call couldn't be started — raise a scheduling exception and offer the candidate a new time"}]$j$::jsonb,
  'needs_scheduling',
  'auto'::automation_mode
from automation_definitions d
where d.key = 'send_booking_link' and d.client_id is null
on conflict (definition_id, version) do nothing;

insert into automation_bindings (automation_definition_id, state)
select d.id, 'active'
from automation_definitions d
where d.key = 'send_booking_link' and d.client_id is null
on conflict (automation_definition_id)
  where company_scope_client_id is null and workflow_template_id is null and job_id is null
  do nothing;

-- ── Honesty pass on the `interview_scheduled` rule ──────────────────────────
--
-- Nothing has ever emitted `interview_scheduled`. This feature makes it fire for
-- the first time — at which point the seeded v1 of that rule goes live
-- advertising two actions that have no executor: `write_calendar_event` ("attach
-- the interviewer briefing package") and a `policy_reminders` task. Leaving them
-- would put "Active · Global library" on the Automations page next to promises
-- the system does not keep.
--
-- Superseded by a v2 describing what actually happens. v1 is archived rather
-- than edited: a definition version is immutable, and archiving is how the
-- library records that it changed its mind.
update automation_definition_versions
   set status = 'archived'
 where definition_id = (
         select id from automation_definitions
          where key = 'interview_scheduled' and client_id is null)
   and version = 1;

insert into automation_definition_versions (
  definition_id, version, status, published_at,
  condition_text, actions, tasks_and_reminders, exceptions, sla_type, default_mode, notes
)
select d.id, 2, 'published', now(),
  $c$A candidate booked a time, or chose to start now.$c$,
  $j$[{"key":"confirm_booking","label":"Confirm the booking to the candidate with the time in their own timezone"},
      {"key":"queue_agent_call","label":"Queue the agent's outbound call for the booked time"}]$j$::jsonb,
  $j$[]$j$::jsonb,
  $j$[{"key":"call_start_failed","label":"The call couldn't be started — raise a scheduling exception"}]$j$::jsonb,
  null,
  'auto'::automation_mode,
  'v1 promised a calendar event and an interviewer briefing package, neither of which has an executor. Agent interviews place a call; they book no calendar. Human-interviewer scheduling will need its own version.'
from automation_definitions d
where d.key = 'interview_scheduled' and d.client_id is null
on conflict (definition_id, version) do nothing;
