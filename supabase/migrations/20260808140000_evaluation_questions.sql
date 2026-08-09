-- Recorded interview questions and answers, per evaluation.
--
-- The evaluation detail panel groups an interview's Q&A by the competency each
-- question was asked to probe, so the reviewer sees "what we assessed" next to
-- "what they actually said". `application_stage_evaluation_notes` already
-- covers free-form reviewer commentary; this is the structured transcript-
-- derived evidence that sits underneath it.
--
-- `competency_id` is nullable: an interviewer can record an off-script
-- question that maps to no declared competency, and those still belong in the
-- record (the UI groups them under "Other questions").

create table if not exists public.application_stage_evaluation_questions (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null
    references public.application_stage_evaluations(id) on delete cascade,
  competency_id uuid
    references public.job_competencies(id) on delete set null,
  question text not null,
  answer text,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.application_stage_evaluation_questions is
  'Q&A captured during one stage evaluation, optionally tied to the job competency the question probes.';

-- The panel always reads a whole evaluation at a time, in display order.
create index if not exists application_stage_evaluation_questions_evaluation_idx
  on public.application_stage_evaluation_questions (evaluation_id, display_order);

alter table public.application_stage_evaluation_questions enable row level security;

-- Matches the sibling evaluation tables: permissive `authenticated`-ALL rather
-- than tenant-scoped. Keep in step with
-- `recruiters_all_application_stage_evaluation_notes` if that policy tightens.
drop policy if exists recruiters_all_application_stage_evaluation_questions
  on public.application_stage_evaluation_questions;
create policy recruiters_all_application_stage_evaluation_questions
  on public.application_stage_evaluation_questions
  for all to authenticated
  using (true)
  with check (true);
