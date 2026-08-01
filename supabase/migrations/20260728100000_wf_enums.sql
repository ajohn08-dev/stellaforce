-- ─────────────────────────────────────────────────────────────────────────────
-- Workflow Templates / Settings Inheritance / Activity Log — new enum types.
-- See CLAUDE.md and the workflow-templates plan for the full reference.
--
-- Note: decision scale for screen/interview stages reuses the existing
-- `rating_scale` enum; only the final offer stage uses `hire_recommendation`.
-- New event types are created here in full (CREATE TYPE), so they are usable
-- immediately in the same migration set — future additions must use
-- ALTER TYPE ... ADD VALUE (which cannot run inside a txn block).
-- ─────────────────────────────────────────────────────────────────────────────

-- Structural stage settings (template + job sub-stage)
create type stage_visibility     as enum ('internal', 'candidate_facing');
create type stage_entry_condition as enum ('manual', 'automatic');
create type interviewer_type      as enum ('human', 'ai', 'external');
create type question_source       as enum ('manual', 'structured', 'ai_assisted');
create type decision_mode         as enum ('single_rater', 'multi_rater');
create type hire_recommendation   as enum ('strong_hire', 'hire', 'no_hire', 'strong_no_hire');

-- Workflow / scheduling / settings
create type scheduling_policy       as enum ('recruiter_led', 'candidate_self_scheduling', 'system_auto_schedule');
create type workflow_template_status as enum ('draft', 'published');
create type settings_scope           as enum ('global', 'client', 'workflow', 'job');

-- Activity log
create type actor_type     as enum ('user', 'system', 'candidate');
create type event_severity as enum ('info', 'action_needed', 'alert');

-- Unified activity/event type: all 31 V3 candidate-lifecycle events plus
-- candidate/job-level activity events. Ordered to mirror the V3 doc's index.
create type activity_event_type as enum (
  -- 31 V3 lifecycle events
  'application_created',
  'candidate_added_to_stage',
  'candidate_data_updated',
  'candidate_leaves_stage',
  'candidate_withdraws',
  'candidate_fast_tracked',
  'candidate_reassigned',
  'note_added',
  'interview_scheduled',
  'interview_rescheduled',
  'interview_reminder_sent',
  'interview_completed',
  'scorecard_link_sent',
  'transcript_submitted',
  'interview_canceled',
  'interview_no_show_candidate',
  'interview_no_show_interviewer',
  'interview_feedback_submitted',
  'all_required_evaluations_completed',
  'evaluation_overdue',
  'stage_sla_breached',
  'candidate_advanced',
  'candidate_rejected',
  'offer_decision',
  'offer_created',
  'offer_accepted',
  'offer_declined',
  'offer_expired',
  'offer_rescinded',
  'application_closed',
  'application_reopened',
  -- candidate/job-level activity (not application-scoped)
  'candidate_created',
  'resume_ingested',
  'job_created',
  'job_published',
  'job_workflow_snapshotted'
);
