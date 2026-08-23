-- Vocabulary for agent-interview self-scheduling.

-- Re-created deliberately: `interview_status` existed and was dropped in
-- 20260807173038 along with the `interviews` table. Same name, one extra value —
-- 'in_progress', so a call already in flight is distinguishable from a future
-- booking. The dispatcher must never re-dial a call that is already ringing.
create type interview_status as enum
  ('scheduled', 'in_progress', 'completed', 'canceled', 'no_show');

-- The lifecycle of one booking-link attempt.
--   pending  -> row created, gate passed, not yet handed to n8n
--   sent     -> n8n accepted it; the link is live
--   booked   -> terminal success; interview_id is set
--   expired  -> token_expires_at passed with no booking
--   canceled -> candidate left the stage or withdrew before booking
--   failed   -> terminal failure; the reason is on the alert activity_event
create type scheduling_request_status as enum
  ('pending', 'sent', 'booked', 'expired', 'canceled', 'failed');

-- Queue state for one durable outbound agent call.
--   suppressed -> deliberately not dialed (kill switch, or a QA fixture guard).
--                 A first-class state, NOT a failure: it must never alert. This
--                 is what lets the whole loop be exercised end to end with zero
--                 real phone calls.
create type scheduled_call_status as enum
  ('pending', 'claimed', 'sent', 'failed', 'canceled', 'suppressed');

-- Six new lifecycle events.
--
-- Note what is NOT here: `interview_scheduled`, `interview_rescheduled`,
-- `interview_canceled`, `interview_completed` and `interview_no_show_candidate`
-- already exist in the enum and have simply never been emitted. They are reused.
--
-- And note there is ONE failure event, not thirteen. `scheduling_failed` carries
-- its reason in `payload.reason_code` (see src/lib/scheduling-reason-codes.ts).
-- Thirteen enum values would put thirteen rows in the automation trigger list
-- that scripts/automation-seed-check.ts asserts is 1:1 with the seeded library,
-- and thirteen things nobody filters on separately.
alter type activity_event_type add value 'automation_skipped_by_policy';
alter type activity_event_type add value 'booking_link_sent';
alter type activity_event_type add value 'booking_link_opened';
alter type activity_event_type add value 'scheduling_failed';
alter type activity_event_type add value 'scheduling_failure_resolved';
alter type activity_event_type add value 'agent_call_dispatched';
