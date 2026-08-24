-- `send_booking_link` v2: any interview stage, not only an AI one.
--
-- v1 said "The stage is an AI interview with an agent assigned…" and the
-- substrate meant it — a human interview could not be booked at all. It now can:
-- the stage's single reviewer is the interviewer, their live Google free/busy is
-- the availability, and no agent call is queued (n8n writes a calendar event
-- instead).
--
-- A new version rather than an edit, because a definition version is immutable
-- and the archived v1 is the record of what the rule used to promise.
update automation_definition_versions
   set status = 'archived'
 where definition_id = (select id from automation_definitions
                         where key = 'send_booking_link' and client_id is null)
   and version = 1;

insert into automation_definition_versions (
  definition_id, version, status, published_at,
  condition_text, actions, tasks_and_reminders, exceptions, sla_type, default_mode, notes
)
select d.id, 2, 'published', now(),
  $c$A screening or interview stage the candidate enters automatically, set to candidate self-scheduling, with either a screening agent or one interviewer assigned.$c$,
  $j$[{"key":"create_scheduling_request","label":"Create a scheduling request and a single-use booking link"},
      {"key":"send_booking_link","label":"Send the candidate their booking link"},
      {"key":"offer_real_availability","label":"Offer only times the agent or the interviewer is genuinely free"},
      {"key":"queue_or_calendar","label":"Queue the agent's call, or create the calendar invite for a person"}]$j$::jsonb,
  $j$[{"key":"expiry_sweep","label":"Flag the recruiter if the link expires unbooked"}]$j$::jsonb,
  $j$[{"key":"no_bookable_slot","label":"No slot inside the booking horizon — raise a scheduling exception"},
      {"key":"agent_capacity_unavailable","label":"The agent is at capacity — raise a scheduling exception"},
      {"key":"interviewer_calendar_not_connected","label":"The interviewer hasn't connected a calendar — raise a scheduling exception"},
      {"key":"panel_not_supported","label":"More than one interviewer on the stage — schedule that one by hand for now"},
      {"key":"call_start_failed","label":"The call couldn't be started — raise a scheduling exception and offer the candidate a new time"}]$j$::jsonb,
  'needs_scheduling',
  'auto'::automation_mode,
  'v1 covered only AI interviews because interview_scheduling_requests.agent_id was NOT NULL. v2 books a single human interviewer from their live Google free/busy. Panels still resolve as not-applicable: job_workflow_sub_stage_reviewers has no required-vs-optional flag, so whose calendar counts has no answer in the schema yet.'
from automation_definitions d
where d.key = 'send_booking_link' and d.client_id is null
on conflict (definition_id, version) do nothing;
