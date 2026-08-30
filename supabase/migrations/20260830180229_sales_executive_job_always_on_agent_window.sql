-- "Start now" was invisible on this job, and the agent link was not the reason.
--
-- `canStartNow` asks whether *this moment* falls inside the stage's operating
-- window, by probing the grid generator with zero notice. The window was
-- weekdays 9-17 Eastern, so on a Sunday there is no callable moment and the
-- button correctly does not render.
--
-- The Pre-Screening agent has no working hours to respect — it is software, and
-- the point of `allow_start_now` is that a candidate who is ready right now gets
-- called right now. Weekday office hours are the right default for a *person*;
-- for an always-on agent stage they only mean "the demo doesn't work at the
-- weekend".
--
-- Scoped to this job, so the global default for human stages is untouched. The
-- Product Designer job still inherits weekdays 9-17 and would show the same
-- behaviour today.
update public.workflow_settings
set config = config
  || '{"operating_hours": "around_the_clock"}'::jsonb
  || '{"operating_days": "all_days"}'::jsonb
where scope = 'job'
  and scope_id = '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92'
  and category = 'scheduling';
