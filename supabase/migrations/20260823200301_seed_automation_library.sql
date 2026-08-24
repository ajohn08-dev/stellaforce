-- The global automation library.
--
-- These 13 rules were hand-written fixtures in src/lib/automation-rules.ts.
-- This migration is where they stop being preview content and become the row
-- the resolver reads.
--
-- Seeded as GLOBAL TRUTH ONLY -- one definition, one published v1 version, one
-- global binding at `active`. The fixture's STATE map also claimed Company,
-- Workflow and Job provenance for a handful of rules; that was visual dressing
-- so the dialog wouldn't look uniform. Seeding it would need a tenant id the
-- seed doesn't have, would assert product decisions nobody made ("this company
-- never fast-tracks"), and at job scope would fabricate a decision on a real req.
--
-- `candidate_data_updated` is deliberately NOT seeded. "A field that feeds
-- search or fit changed" names no field group and no action beyond "re-embed" --
-- it is not a contract, and a row the resolver cannot explain is worse than an
-- absent one. It returns when it has a defined trigger condition.

-- ---------------------------------------------------------------------------
-- 1. Definitions
-- ---------------------------------------------------------------------------
insert into automation_definitions (key, name, trigger_event_type, category)
values
  ('candidate_added_to_stage',            'Candidate added to stage',                                'candidate_added_to_stage',            'lifecycle'),
  ('candidate_leaves_stage',              'Candidate leaves stage (qualified or disqualified)',      'candidate_leaves_stage',              'lifecycle'),
  ('candidate_withdraws',                 'Candidate withdraws application',                         'candidate_withdraws',                 'lifecycle'),
  ('candidate_fast_tracked',              'Candidate skipped / fast-tracked to later stage',         'candidate_fast_tracked',              'lifecycle'),
  ('interview_scheduled',                 'Interview scheduled',                                     'interview_scheduled',                 'scheduling'),
  ('interview_rescheduled',               'Interview rescheduled',                                   'interview_rescheduled',               'scheduling'),
  ('interview_completed',                 'Interview completed',                                     'interview_completed',                 'scheduling'),
  ('interview_canceled',                  'Interview canceled',                                      'interview_canceled',                  'scheduling'),
  ('interview_no_show_candidate',         'Interview no-show – candidate',                           'interview_no_show_candidate',         'scheduling'),
  ('interview_no_show_interviewer',       'Interview no-show – interviewer',                         'interview_no_show_interviewer',       'scheduling'),
  ('all_required_evaluations_completed',  'All required evaluations completed',                      'all_required_evaluations_completed',  'evaluation'),
  ('evaluation_overdue',                  'Evaluation overdue (no scorecard after 24 hours)',        'evaluation_overdue',                  'evaluation'),
  ('decision_made',                       'Decision made (advance / reject / offer created)',        'decision_made',                       'evaluation')
on conflict (key) where client_id is null do nothing;

-- ---------------------------------------------------------------------------
-- 2. Published v1 versions.
--
-- Action keys are hard-coded slugs rather than generated from the labels: a
-- slugify() in Postgres that can disagree with slug() in
-- src/lib/policy-settings.ts is a second source of truth, and a seed is a
-- snapshot, not a derivation.
--
-- `default_mode` is seeded from product intent, not defaulted. The five
-- `approval_required` rules are exactly the externally consequential ones --
-- they send rejection wording, a cancellation to a candidate, a no-show
-- follow-up, a fast-track that skips required stages, or create an offer.
-- It is descriptive: it has no runtime effect until an executor exists.
-- ---------------------------------------------------------------------------
insert into automation_definition_versions (
  definition_id, version, status, published_at,
  condition_text, actions, tasks_and_reminders, exceptions, sla_type, default_mode
)
select d.id, 1, 'published', now(),
       v.condition_text, v.actions::jsonb, v.tasks::jsonb, v.exceptions::jsonb,
       v.sla_type, v.default_mode::automation_mode
from automation_definitions d
join (values
  ('candidate_added_to_stage',
   $c$The stage has an owner and the role's agent context compiles.$c$,
   $j$[{"key":"send_stage_message","label":"Send the stage's candidate-facing message, if it has one"},
       {"key":"assign_owner_start_sla","label":"Assign the stage owner and start the stage's SLA clock"},
       {"key":"compile_agent_context","label":"Compile the screening agent's context for this role"}]$j$,
   $j$[{"key":"owner_manual_entry_task","label":"Task for the stage owner when entry needs a manual action"},
       {"key":"owner_half_sla_reminder","label":"Reminder to the owner at half the stage SLA"}]$j$,
   $j$[{"key":"missing_sensitive_answer","label":"Company knowledge is missing a sensitive answer — hand the topic to the recruiter"},
       {"key":"no_stage_owner","label":"No stage owner set — escalate to the job's account owner"}]$j$,
   'needs_scheduling', 'auto'),

  ('candidate_leaves_stage',
   $c$A decision is recorded on the stage.$c$,
   $j$[{"key":"close_tasks_stop_sla","label":"Close the stage's open tasks and stop its SLA clock"},
       {"key":"advance_or_record_outcome","label":"Advance to the next sub-stage, or record the outcome"},
       {"key":"send_outcome_message","label":"Send the stage's outcome message"}]$j$,
   $j$[{"key":"approve_rejection_wording","label":"Task for the recruiter to approve rejection wording before it sends"}]$j$,
   $j$[{"key":"no_decision_recorded","label":"No decision recorded after the interview — hold and notify the stage owner"}]$j$,
   'needs_decision', 'approval_required'),

  ('candidate_withdraws',
   $c$Always — a withdrawal is never conditional.$c$,
   $j$[{"key":"mark_withdrawn","label":"Mark the application withdrawn and release the pipeline slot"},
       {"key":"cancel_booked_interview","label":"Cancel any booked interview and give the interviewer their time back"}]$j$,
   $j$[{"key":"log_withdrawal_reason","label":"Task for the recruiter to log the reason"}]$j$,
   $j$[{"key":"calendar_cancel_failed","label":"Calendar event couldn't be cancelled — alert the coordinator"}]$j$,
   null, 'auto'),

  ('candidate_fast_tracked',
   $c$None of the skipped stages is marked required for the role.$c$,
   $j$[{"key":"skip_sub_stages","label":"Skip the intervening sub-stages and record why"},
       {"key":"compile_agent_context","label":"Compile the agent context for the stage they land in"}]$j$,
   $j$[{"key":"hiring_manager_confirm_skip","label":"Task for the hiring manager to confirm the skip"}]$j$,
   $j$[{"key":"required_stage_skipped","label":"A stage the role requires was skipped — escalate to the account owner"}]$j$,
   null, 'approval_required'),

  ('interview_scheduled',
   $c$The stage is a booked interview, not an async or external one.$c$,
   $j$[{"key":"send_confirmation","label":"Send the confirmation the communication policy specifies"},
       {"key":"write_calendar_event","label":"Write the calendar event and attach the interviewer briefing package"}]$j$,
   $j$[{"key":"policy_reminders","label":"Candidate and interviewer reminders on the schedule the policy sets"}]$j$,
   $j$[{"key":"calendar_write_failed","label":"Calendar write failed — follow the calendar write failure policy"}]$j$,
   null, 'auto'),

  ('interview_rescheduled',
   $c$The candidate has reschedules left under the stage's policy.$c$,
   $j$[{"key":"update_calendar_event","label":"Update the calendar event and re-send both confirmations"},
       {"key":"reset_reminder_schedule","label":"Reset the reminder schedule to the new time"}]$j$,
   $j$[{"key":"last_reschedule_task","label":"Task for the coordinator once the candidate has used their last reschedule"}]$j$,
   $j$[{"key":"no_slot_in_horizon","label":"No slot inside the booking horizon — follow the no-slot fallback"}]$j$,
   null, 'auto'),

  ('interview_completed',
   $c$The interview ran to completion — not cancelled, not a no-show.$c$,
   $j$[{"key":"open_scorecards","label":"Open the scorecard for every required interviewer"},
       {"key":"attach_recording","label":"Attach the recording and transcript to the evaluation"}]$j$,
   $j$[{"key":"feedback_reminders","label":"Feedback reminders on the policy's escalating sequence"}]$j$,
   $j$[{"key":"recording_missing","label":"Recording never arrived — mark the evaluation incomplete for review"}]$j$,
   'needs_feedback', 'auto'),

  ('interview_canceled',
   $c$Cancelled before it started, by either side.$c$,
   $j$[{"key":"release_slot","label":"Release the slot and cancel the calendar event"},
       {"key":"notify_candidate","label":"Tell the candidate, using the stage's cancellation wording"}]$j$,
   $j$[{"key":"coordinator_rebook","label":"Task for the coordinator to rebook"}]$j$,
   $j$[{"key":"cancelled_inside_cutoff","label":"Cancelled inside the cutoff — notify the stage owner"}]$j$,
   null, 'approval_required'),

  ('interview_no_show_candidate',
   $c$No candidate join after the grace period, and the interviewer waited.$c$,
   $j$[{"key":"record_no_show","label":"Record the no-show on the application"},
       {"key":"send_follow_up","label":"Send the follow-up the policy specifies"}]$j$,
   $j$[{"key":"rebook_or_close","label":"Task for the recruiter: rebook or close"}]$j$,
   $j$[{"key":"second_no_show","label":"Second no-show — escalate to the account owner"}]$j$,
   null, 'approval_required'),

  ('interview_no_show_interviewer',
   $c$The candidate joined and no required interviewer did.$c$,
   $j$[{"key":"record_no_show_apologise","label":"Record the no-show and apologise to the candidate"},
       {"key":"offer_new_slot","label":"Offer the candidate a new slot straight away"}]$j$,
   $j$[{"key":"rebook_with_backup","label":"Task for the coordinator to rebook with an approved backup"}]$j$,
   $j$[{"key":"no_backup_interviewer","label":"No backup interviewer approved — escalate to the hiring manager"}]$j$,
   null, 'auto'),

  ('all_required_evaluations_completed',
   $c$Every required rater has submitted a scorecard.$c$,
   $j$[{"key":"compute_scorecard","label":"Compute the application scorecard from the submitted evaluations"},
       {"key":"notify_decision_owner","label":"Tell the decision owner it's ready"}]$j$,
   $j$[{"key":"decision_owner_24h_reminder","label":"Reminder to the decision owner after 24 hours"}]$j$,
   $j$[{"key":"rater_disagreement","label":"Raters disagree beyond the threshold — hold for the hiring manager"}]$j$,
   'needs_decision', 'auto'),

  ('evaluation_overdue',
   $c$No scorecard 24 hours after the interview ended.$c$,
   $j$[{"key":"chase_interviewer","label":"Chase the interviewer on the reminder channel"}]$j$,
   $j$[{"key":"escalating_sequence","label":"Escalating sequence: 2 hours, then 24 hours"}]$j$,
   $j$[{"key":"still_missing_reassign","label":"Still missing after the sequence — reassign to the stage owner"}]$j$,
   'needs_feedback', 'auto'),

  ('decision_made',
   $c$The decision owner recorded an outcome.$c$,
   $j$[{"key":"apply_decision","label":"Advance, reject, or create the offer"},
       {"key":"send_decision_message","label":"Send the stage's decision message"},
       {"key":"close_tasks_stop_sla","label":"Close the stage's tasks and stop its SLA clock"}]$j$,
   $j$[{"key":"create_offer_task","label":"Task for the recruiter to create the offer when the decision is Offer"}]$j$,
   $j$[{"key":"decision_overridden","label":"Decision overridden — record who overrode it and why"}]$j$,
   'needs_offer_creation', 'approval_required')
) as v(key, condition_text, actions, tasks, exceptions, sla_type, default_mode)
  on v.key = d.key
where d.client_id is null
on conflict (definition_id, version) do nothing;

-- ---------------------------------------------------------------------------
-- 3. One global binding per definition, `active`.
--
-- Active rather than off, deliberately: an off library ships a screen full of
-- rules that exist but do nothing, and the first thing anyone would have to do
-- is turn thirteen of them on. A job may still pause or turn any of them off.
-- ---------------------------------------------------------------------------
insert into automation_bindings (automation_definition_id, state)
select d.id, 'active'
from automation_definitions d
where d.client_id is null
on conflict (automation_definition_id)
  where company_scope_client_id is null and workflow_template_id is null and job_id is null
  do nothing;
