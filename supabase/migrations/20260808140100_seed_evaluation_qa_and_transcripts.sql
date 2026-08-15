-- Seed interview Q&A + call transcripts for the QA fixture evaluations.
--
-- Extends `20260808130000_seed_stage_evaluations_qa_fixtures`: that one created
-- the evaluation rows, this one gives each of them the detail the evaluation
-- side panel renders — a question/answer per competency the sub-stage assesses,
-- and a `call_recordings` row whose transcript is built from those exchanges.
--
-- Answers are keyed off the same per-application variant the evaluation copy
-- used, so a candidate who reads "strong" in the summary also gives the strong
-- answers. One question per competency, phrased to probe that competency.
--
-- Audio is NOT attached here — the file bytes live in Storage, which SQL can't
-- reach. `scripts/attach-fixture-call-audio.mjs` copies a real recording into a
-- per-evaluation object path and flips `audio_status` to 'uploaded'.
--
-- Scoped to `candidates.source = 'qa_test_fixture'`, so it is a no-op without
-- the fixtures and disappears when they are deleted (Q&A cascades off the
-- evaluation, which cascades off the application, which cascades off the
-- candidate).

-- Re-runnable.
delete from public.application_stage_evaluation_questions q
using public.application_stage_evaluations e,
      public.applications a,
      public.candidates c
where q.evaluation_id = e.id
  and e.application_id = a.application_id
  and a.candidate_id = c.candidate_id
  and c.source = 'qa_test_fixture';

delete from public.call_recordings r
using public.applications a, public.candidates c
where r.application_id = a.application_id
  and a.candidate_id = c.candidate_id
  and c.source = 'qa_test_fixture';

-- ---------------------------------------------------------------------------
-- 1. Q&A, one row per (evaluation, competency assessed by that sub-stage)
-- ---------------------------------------------------------------------------
with target_app as (
  select
    a.application_id,
    -- Same ordering as the evaluation seed, so variants line up.
    (row_number() over (order by a.application_id))::int as app_idx
  from public.applications a
  join public.candidates c on c.candidate_id = a.candidate_id
  where c.source = 'qa_test_fixture'
    and a.current_stage_id is not null
),
qa_copy (competency, question, variant, answer) as (
  values
  ('Domain knowledge in legal technology',
   'What exposure have you had to legal or other highly regulated workflows, and how did that shape your design decisions?',
   0, 'Two years on a claims-adjudication tool in insurance. Regulated in a similar way - every action had to be attributable - so I designed an always-visible audit trail and made destructive actions two-step. No direct legal experience, but the constraints rhyme.'),
  ('Domain knowledge in legal technology',
   'What exposure have you had to legal or other highly regulated workflows, and how did that shape your design decisions?',
   1, 'Mostly consumer and marketplace work so far. I read up on e-discovery and matter management to prepare for this conversation, but I have not designed against those workflows myself. I would lean on subject-matter experts early.'),
  ('Domain knowledge in legal technology',
   'What exposure have you had to legal or other highly regulated workflows, and how did that shape your design decisions?',
   2, 'Three years on a contract lifecycle product. I sat in on redlining sessions with in-house counsel, which changed how I thought about version history - lawyers do not want a diff, they want to know who agreed to what and when. That reframing shipped as a clause-level approval timeline.'),

  ('User research and design validation',
   'Walk me through how you validated a design decision that you initially got wrong.',
   0, 'We shipped a bulk-action bar nobody used. Five moderated sessions in Maze showed people did not believe selections persisted across pages. We added a persistent selection count and usage went from near zero to about a third of sessions.'),
  ('User research and design validation',
   'Walk me through how you validated a design decision that you initially got wrong.',
   1, 'I usually get research from our researcher rather than running it myself. On one project the usability test showed people missed a filter, so we made it more prominent. I would like to be closer to the sessions than I have been.'),
  ('User research and design validation',
   'Walk me through how you validated a design decision that you initially got wrong.',
   2, 'I ran a generative round first - eight contextual interviews - and my mental model of the reviewer persona was wrong: they worked queue-first, not document-first. I rebuilt the information architecture around the queue, validated with an unmoderated Maze study, and time-to-first-action dropped roughly 40 percent.'),

  ('Enterprise and professional-user UX judgment',
   'How do you balance information density against clarity for expert users who live in the tool all day?',
   0, 'I start dense and earn the whitespace back. Power users resent pagination and progressive disclosure that hides what they already know, so I ship a compact default with an expand affordance rather than the reverse.'),
  ('Enterprise and professional-user UX judgment',
   'How do you balance information density against clarity for expert users who live in the tool all day?',
   1, 'I tend to reach for a cleaner, more spacious layout and then add density where users complain. It has worked, though I have been corrected a few times by users who wanted more on screen at once.'),
  ('Enterprise and professional-user UX judgment',
   'How do you balance information density against clarity for expert users who live in the tool all day?',
   2, 'Density is not the enemy - undifferentiated density is. I use typographic hierarchy and alignment to make a dense table scannable, keep the primary scan column left-aligned and fixed, and reserve colour strictly for state. I also design the keyboard path first for anyone in the tool more than an hour a day.'),

  ('Cross-functional collaboration',
   'Tell me about a time you and a product manager or engineer disagreed on an approach.',
   0, 'The PM wanted a wizard, I wanted a single form. We built both as throwaway prototypes and tested with six users in two days. The form won on completion time and we shipped it - having data made the disagreement short.'),
  ('Cross-functional collaboration',
   'Tell me about a time you and a product manager or engineer disagreed on an approach.',
   1, 'It does not come up often; I generally align with the PM early so we do not diverge. When engineering pushed back on an animation for performance reasons, I dropped it.'),
  ('Cross-functional collaboration',
   'Tell me about a time you and a product manager or engineer disagreed on an approach.',
   2, 'Engineering said a live-preview pattern was too expensive. Rather than argue in the abstract I asked what budget was realistic, got a number, and redesigned to a debounced preview that fit it. We shipped on time and the pattern is now used in three other places.'),

  ('Design communication and storytelling',
   'How do you present design work to an audience that includes both engineers and executives?',
   0, 'I lead with the user problem and the constraint, show the decision, then the alternatives I rejected and why. Executives stay for the first two minutes, engineers stay for the rest, and the rejected-alternatives slide stops the meeting relitigating old ground.'),
  ('Design communication and storytelling',
   'How do you present design work to an audience that includes both engineers and executives?',
   1, 'I usually walk through the screens in order and explain what each one does, then take questions. I have been told I could be more concise for senior audiences.'),
  ('Design communication and storytelling',
   'How do you present design work to an audience that includes both engineers and executives?',
   2, 'A different artefact per audience. Executives get one slide - the problem, the bet, the measure. Engineers get the Figma file with edge cases annotated and a Loom walkthrough they can watch async. I write the rationale into Notion either way so the decision survives the meeting.'),

  ('Design ownership and initiative',
   'Describe something you identified and drove yourself, without being asked.',
   0, 'Our empty states were inconsistent across eleven surfaces. I audited them, proposed a single pattern, and got it into the next sprint by scoping it small enough that it did not need a roadmap slot.'),
  ('Design ownership and initiative',
   'Describe something you identified and drove yourself, without being asked.',
   1, 'Most of my work has come through the roadmap. I have improved things within the projects I was given - tightening flows, catching edge cases - but I have not started a workstream from scratch.'),
  ('Design ownership and initiative',
   'Describe something you identified and drove yourself, without being asked.',
   2, 'I noticed the trial-to-paid drop happened at a step nobody owned. I pulled the funnel data myself, interviewed five churned trials, and wrote a one-page case. It became a quarter objective, I led the design, and conversion moved about six points.'),

  ('End-to-end product design',
   'Take one feature you owned end to end and walk me from problem to shipped.',
   0, 'Bulk document tagging. Started from support tickets, mapped the current flow, prototyped three interaction models in Figma, tested two, shipped the winner behind a flag, then iterated twice on the selection model after watching session replays.'),
  ('End-to-end product design',
   'Take one feature you owned end to end and walk me from problem to shipped.',
   1, 'I designed a notifications centre. I took the requirements from the PM, designed the screens and states, handed off to engineering, and reviewed the build before release.'),
  ('End-to-end product design',
   'Take one feature you owned end to end and walk me from problem to shipped.',
   2, 'A reviewer inbox, from discovery through post-launch. I framed the problem with the queue research, mapped every state including the ugly ones - conflicts, stale locks, partial saves - prototyped the interaction, ran a five-person test, shipped, then used the first month of telemetry to cut two steps out of the primary path.'),

  ('Complex workflow and process design',
   'How do you approach a multi-step workflow with a lot of edge cases?',
   0, 'I map the happy path first, then deliberately break it - what happens on timeout, on conflict, on partial permission - and design each of those before touching visual design. The edge cases usually reshape the happy path.'),
  ('Complex workflow and process design',
   'How do you approach a multi-step workflow with a lot of edge cases?',
   1, 'I design the main flow carefully and handle edge cases as they surface during build. Engineering is usually good at flagging the ones I missed.'),
  ('Complex workflow and process design',
   'How do you approach a multi-step workflow with a lot of edge cases?',
   2, 'I write the state machine before I open Figma - every state, every transition, every failure. Then I look for states that only exist because of an earlier design choice and remove those. On the last one that collapsed nine states to five, which took a week out of the build.'),

  ('AI-integrated product experience design',
   'How do you design for a model that is sometimes wrong?',
   0, 'Show confidence, never assert. I present model output as a suggestion with a visible accept or reject, and I make the reject path as fast as the accept path so people are not punished for disagreeing.'),
  ('AI-integrated product experience design',
   'How do you design for a model that is sometimes wrong?',
   1, 'I would surface the result clearly and give the user a way to edit it. I have not shipped much AI-facing UI yet, so this is more principle than practice for me.'),
  ('AI-integrated product experience design',
   'How do you design for a model that is sometimes wrong?',
   2, 'Three things: signal confidence in a way that maps to consequence, keep a human in the loop wherever the action is hard to reverse, and always show the source. On our extraction feature we highlighted the span in the original document behind every extracted field - trust went up far more from the citation than from any accuracy gain.'),

  ('Design systems and component thinking',
   'What has your involvement with design systems looked like?',
   0, 'I contributed components and pattern documentation to a shared library, and pushed for tokens over hard-coded values so theming did not fork per surface.'),
  ('Design systems and component thinking',
   'What has your involvement with design systems looked like?',
   1, 'I use our design system consistently and raise gaps with the team that owns it, but I have not been a maintainer myself.'),
  ('Design systems and component thinking',
   'What has your involvement with design systems looked like?',
   2, 'I consolidated three divergent libraries into one. The hard part was not the components, it was the governance - I set a contribution path and an accessibility checklist as a merge gate. Adoption went from about half to over ninety percent of surfaces in two quarters.')
)
insert into public.application_stage_evaluation_questions
  (evaluation_id, competency_id, question, answer, display_order)
select
  e.id,
  jc.id,
  qa.question,
  qa.answer,
  (row_number() over (partition by e.id order by jc.type, jc.description))::int - 1
from public.application_stage_evaluations e
join target_app t on t.application_id = e.application_id
join public.job_workflow_sub_stage_competencies sc on sc.sub_stage_id = e.sub_stage_id
join public.job_competencies jc on jc.id = sc.competency_id
join qa_copy qa
  on qa.competency = jc.description
 and qa.variant = t.app_idx % 3;

-- ---------------------------------------------------------------------------
-- 2. One call recording per evaluation, transcript built from its own Q&A
-- ---------------------------------------------------------------------------
insert into public.call_recordings (
  application_id, evaluation_id, sub_stage_id, candidate_id, job_id, client_id,
  agent_id, interviewer_type, is_test, transcript_text, transcript_status,
  duration_seconds, started_at, title, summary, call_status, call_successful,
  audio_status
)
select
  a.application_id,
  e.id,
  e.sub_stage_id,
  a.candidate_id,
  a.job_id,
  j.client_id,
  case when s.interviewer_type = 'ai' then ag.id end,
  s.interviewer_type,
  false,
  -- "Agent:"/"Candidate:" is the shape parseTranscriptText() understands; on a
  -- human-run stage the "agent" side is simply the interviewer.
  'Agent: Thanks for making the time. This is the ' || s.name
    || ' for the Product Designer role. I will keep it to about '
    || (10 + 5 * qa.n) || ' minutes and leave room at the end for your questions.'
    || E'\n\nCandidate: Happy to be here - thanks for setting it up.' || E'\n\n'
    || qa.body
    || E'\n\nAgent: That is everything from my side. Anything you would like to ask me?'
    || E'\n\nCandidate: Nothing further right now. Thank you for the time.',
  'transcribed',
  60 * (10 + 5 * qa.n) + (qa.n * 17),
  e.interview_date,
  s.name || ' - ' || c.first_name || ' ' || c.last_name,
  e.summary,
  'completed',
  'success',
  'pending'
from public.application_stage_evaluations e
join public.applications a on a.application_id = e.application_id
join public.candidates c on c.candidate_id = a.candidate_id
join public.job_orders j on j.job_id = a.job_id
join public.job_workflow_sub_stages s on s.id = e.sub_stage_id
left join public.agents ag on ag.name = 'Generalist Recruiter Screen'
join lateral (
  select
    count(*)::int as n,
    string_agg(
      'Agent: ' || q.question || E'\n\nCandidate: ' || coalesce(q.answer, 'No answer recorded.'),
      E'\n\n' order by q.display_order
    ) as body
  from public.application_stage_evaluation_questions q
  where q.evaluation_id = e.id
) qa on qa.n > 0
where c.source = 'qa_test_fixture';
