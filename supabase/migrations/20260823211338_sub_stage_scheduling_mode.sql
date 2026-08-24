-- The gate's discriminator: which stages self-schedule.
--
-- Typed as `scheduling_policy`, an enum created back in 20260728100000 that no
-- column has ever used. Its three values are exactly right, so this attaches it
-- rather than inventing a parallel vocabulary.
--
-- Everything else about scheduling (booking horizon, minimum notice, slot
-- length, hold duration, operating hours) stays in the sub-stage's `config`
-- jsonb, whose write path is already complete: sub-stage-scheduling-panel.tsx ->
-- toRow/fromRow in workflow-stages-tab.tsx -> saveTemplateSubStages ->
-- publishJob's snapshot. Those values are read exactly once, by id, when a
-- scheduling request is created; none is ever a WHERE clause, so none earns a
-- typed column.
--
-- `scheduling_mode` is different: it IS a WHERE clause, evaluated by system code
-- with no session on the trigger path. A gate predicate buried in an untyped
-- jsonb blob is precisely the thing that silently stops matching after a UI
-- refactor, and `config #>> '{scheduling,mode}'` cannot be indexed without an
-- expression index.
--
-- NULL means "inherit the workflow's policy".
alter table public.workflow_template_sub_stages
  add column scheduling_mode scheduling_policy;

alter table public.job_workflow_sub_stages
  add column scheduling_mode scheduling_policy;

-- No backfill: verified that `config` is empty on every row of both tables
-- (0 non-empty), so there is nothing stored under `{scheduling,mode}` to migrate.
-- The panel writes to the column from here on.

-- The trigger path's hot predicate: "self-scheduling agent stages on this job".
-- `entry_conditions` is an array so it stays out of the index and is checked in
-- the query.
create index idx_job_sub_stages_self_scheduling
  on public.job_workflow_sub_stages (job_id)
  where scheduling_mode = 'candidate_self_scheduling'
    and interviewer_type = 'ai';

comment on column public.job_workflow_sub_stages.scheduling_mode is
  'NULL = inherit the workflow scheduling policy. Agent-interview '
  'self-scheduling requires candidate_self_scheduling AND interviewer_type = ''ai'' '
  'AND agent_id IS NOT NULL AND ''automatic'' = ANY(entry_conditions).';

comment on column public.workflow_template_sub_stages.scheduling_mode is
  'Template default for job_workflow_sub_stages.scheduling_mode; snapshotted at publish.';
