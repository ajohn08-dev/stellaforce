-- Automation control plane: the vocabulary.
--
-- Three enums, deliberately. Everything else the automation tables need
-- (category, sla_type) stays free `text`, following the house precedent set by
-- `workflow_settings.category` and `sla_policies.sla_type`: enum when the set is
-- closed and the code branches on it, text when the set grows with configuration.

-- Saved configuration state for an automation at one scope.
--
-- Three values, not a boolean. `paused` is the one that earns its place: an
-- automation switched off for a fortnight while a hiring manager is away is a
-- different thing from one this company never runs, and collapsing them loses
-- the only bit of information anyone needs later -- whether it's coming back.
--
-- `off`, not `stopped`: runtime verbs (pending/running/succeeded/failed/
-- skipped/cancelled) are reserved for the executor's own enums when it lands.
-- A configuration state and an execution outcome must not share a vocabulary.
create type automation_state as enum ('active', 'paused', 'off');

-- The authored approval posture of a rule *version* -- does this need a human
-- before an externally consequential side effect. Descriptive only until an
-- executor exists.
--
-- Deliberately NOT a way to disable an automation; that is exclusively
-- `automation_state = 'off'`. The old app vocabulary had `auto | manual | off`,
-- where `off` duplicated the state axis and `manual` was ambiguous about what
-- was being asked of whom.
create type automation_mode as enum ('auto', 'approval_required');

-- Publication lifecycle of a definition version. Same shape as
-- `workflow_template_status`, plus the retire-never-delete rung.
create type automation_version_status as enum ('draft', 'published', 'archived');

-- `decision_made` -- a decision owner recorded an outcome (advance / reject /
-- offer created).
--
-- Genuinely distinct from everything already in the enum. Hanging it off
-- `candidate_leaves_stage` would collapse two rules with different SLAs
-- (`needs_decision` vs `needs_offer_creation`) and would miss `offer_created`,
-- which is not a stage exit; `offer_decision` covers only one of the three
-- outcomes.
--
-- Nothing emits it yet -- there is no executor in this pass. It exists so a
-- seeded definition can name a real trigger. The emit site, when it lands, is
-- `moveCandidate` / `rejectCandidate` in src/app/(app)/jobs/actions.ts, which
-- already call `logActivity` two or three times per transition.
--
-- NOTE: the new value cannot be *used* until a later transaction, which is why
-- the seed is its own migration file.
alter type activity_event_type add value 'decision_made';
