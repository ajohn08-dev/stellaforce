-- Seed L2 stage evaluations for the QA fixture candidates.
--
-- The pipeline board's Overview/Evaluation tabs read
-- `application_stage_evaluations` (+ `_notes`) but nothing writes them yet (no
-- submission UI), so every fixture candidate rendered "evaluation pending" for
-- every stage they had already cleared. This backfills a completed evaluation
-- for each *prior* evaluable sub-stage of each fixture application — the stage
-- the candidate currently sits in is deliberately left without a row so it
-- still shows the pending "Add evaluation" card.
--
-- Scoped to `candidates.source = 'qa_test_fixture'`, so this is a no-op on any
-- database without the fixtures (and it disappears with them — evaluations
-- cascade on `applications`, which cascade on `candidates`). See the "QA test
-- fixtures — DELETE BEFORE LAUNCH" section of CLAUDE.md.
--
-- Content is derived from what the job already defines: each sub-stage's
-- purpose, format, interviewer type and attached competencies. Three variants
-- keyed off the application's index give the board a spread of strong /
-- middling / mixed candidates; one variant is used for all of a candidate's
-- stages so a single candidate reads consistently across their loop.
--
-- `rubric_score` is written on a 0-5 scale because that is what the UI renders
-- (a 5-star row in the Evaluation tab, "x/5" in the Overview tab), even though
-- the sub-stages themselves declare `rating_scale = 'ten-point'`.

-- Re-runnable: drop anything previously seeded for these applications first
-- (notes cascade off the evaluation row).
delete from public.application_stage_evaluations e
using public.applications a, public.candidates c
where e.application_id = a.application_id
  and a.candidate_id = c.candidate_id
  and c.source = 'qa_test_fixture';

with target_app as (
  select
    a.application_id,
    a.job_id,
    a.current_stage_id,
    -- Stable per-application index → picks this candidate's copy variant.
    (row_number() over (order by a.application_id))::int as app_idx
  from public.applications a
  join public.candidates c on c.candidate_id = a.candidate_id
  where c.source = 'qa_test_fixture'
    and a.current_stage_id is not null
),
-- Every sub-stage of the relevant jobs in true pipeline order.
ordered_stage as (
  select
    s.id,
    s.job_id,
    s.name,
    s.format,
    ps.key as group_key,
    (row_number() over (
      partition by s.job_id
      order by ps.display_order, s.display_order
    ))::int as pos
  from public.job_workflow_sub_stages s
  join public.pipeline_stages ps on ps.id = s.pipeline_stage_id
),
-- The stages each application has already cleared. `source` is excluded:
-- sourcing is not an interview and the Evaluation tab never renders it.
prior_stage as (
  select
    t.application_id,
    t.app_idx,
    t.job_id,
    o.id as sub_stage_id,
    o.name as stage_name,
    o.format,
    (cur.pos - o.pos)::int as steps_back
  from target_app t
  join ordered_stage cur on cur.id = t.current_stage_id
  join ordered_stage o
    on o.job_id = cur.job_id
   and o.pos < cur.pos
   and o.group_key <> 'source'
),
stage_copy (stage_name, variant, score, summary, notes) as (
  values
  ('Pre-Screening', 0, 4.0,
   'AI pre-screen call completed. Confirmed baseline qualifications, availability and comp expectations, and gauged interest in an enterprise legal-tech product. Enough signal on data-dense B2B work to advance to a recruiter screen.',
   array[
     'Currently designs data-dense B2B interfaces; comfortable with power-user workflows.',
     'No direct legal-tech exposure, but has worked on compliance-heavy internal tooling.',
     'Notice period four weeks; open to hybrid, comp expectations within band.'
   ]),
  ('Pre-Screening', 1, 3.5,
   'AI pre-screen call completed. Baseline qualifications confirmed. Enterprise UX experience is real but shallower than the role calls for; advancing with a flag for the recruiter to probe workflow complexity.',
   array[
     'Portfolio is consumer-leaning; enterprise work is limited to one internal admin tool.',
     'Articulate on research methods - mentioned usability testing and synthesis in Dovetail.',
     'Immediately available; wants a role with more end-to-end ownership.'
   ]),
  ('Pre-Screening', 2, 4.5,
   'AI pre-screen call completed. Strong match against the screening criteria - direct experience designing for regulated, high-stakes professional workflows and clear interest in the legal-tech domain.',
   array[
     'Has shipped in a regulated domain and spoke fluently about auditability and permissions.',
     'Described a document-review-style workflow they redesigned end to end.',
     'Comp expectations at the top of the band; flexible on start date.'
   ]),

  ('Recruiter Screen', 0, 4.2,
   'Live recruiter screen. Walked the portfolio and two case studies; presents design decisions clearly and ties them back to user and business outcomes. Logistics confirmed, advancing to HR.',
   array[
     'Case study on a permissions-heavy admin redesign was the strongest signal - clear problem framing.',
     'Comfortable defending tradeoffs; handled pushback on an information-density decision well.',
     'Works closely with PM and engineering; described a Linear and Figma handoff rhythm.'
   ]),
  ('Recruiter Screen', 1, 3.8,
   'Live recruiter screen. Solid communicator with relevant enterprise exposure. Portfolio narration leans on visuals more than reasoning - asked the later panels to probe decision rationale directly.',
   array[
     'Describes what was built more readily than why; needs prompting to surface tradeoffs.',
     'Research involvement is real but mostly evaluative - usability testing rather than generative.',
     'Collaboration signals are good: embedded in a squad with a PM and four engineers.'
   ]),
  ('Recruiter Screen', 2, 4.6,
   'Live recruiter screen. Excellent storyteller - structured each case study around the problem, the constraint and the measured outcome. No concerns on communication or motivation; strong advance.',
   array[
     'Led a design-system consolidation and could quantify the adoption impact.',
     'Explicitly sought out legal tech and referenced the public product documentation.',
     'Aligned on comp, location and start date; no competing offers disclosed.'
   ]),

  ('HR Interview', 0, 4.0,
   'HR and values interview. Collaborative and self-aware; examples were specific and showed a habit of pulling engineers in early. No values concerns raised.',
   array[
     'Handled a conflict story well - a disagreement with a PM resolved by testing both flows.',
     'Motivation is credible: wants domain depth rather than another consumer surface.',
     'Asked thoughtful questions about how design and legal subject-matter experts work together here.'
   ]),
  ('HR Interview', 1, 3.6,
   'HR and values interview. Positive overall, with one flag: examples of navigating ambiguity were thin and drawn almost entirely from well-scoped projects.',
   array[
     'Comfortable in structured processes; little evidence of operating without a clear brief.',
     'Good listener; adjusted answers once given context about our team size.',
     'No concerns on communication or professionalism.'
   ]),
  ('HR Interview', 2, 4.4,
   'HR and values interview. Strong culture signal - defaults to shared ownership and was candid about a project that failed and what they changed afterwards.',
   array[
     'Described running a lightweight critique ritual that improved cross-team consistency.',
     'Comfortable with async documentation; keeps rationale in Notion with Loom walkthroughs.',
     'Genuine interest in the legal operations persona; asked about direct customer access.'
   ]),

  ('Hiring Manager Interview', 0, 4.1,
   'Hiring manager interview on role fit and ownership. Scopes their own work and pushes back constructively on unclear requirements. Comfortable at the level the role needs.',
   array[
     'Walked through prioritizing a backlog of design debt against feature work.',
     'Has driven decisions in early-stage ambiguity - spun up a discovery track unprompted.',
     'Would want mentorship on stakeholder management above the director level.'
   ]),
  ('Hiring Manager Interview', 1, 3.7,
   'Hiring manager interview. Capable and personable, but ownership examples were mostly execution-level; leaned on the PM for problem framing.',
   array[
     'Strong craft, lighter on initiative - most projects arrived pre-scoped.',
     'Advocated well for a user need in one example, but escalated late.',
     'Would likely grow into the level with a clear manager and a defined surface.'
   ]),
  ('Hiring Manager Interview', 2, 4.5,
   'Hiring manager interview. Operates autonomously - identified and framed a problem the team had not prioritized, then built the case that got it staffed. Clear yes at this stage.',
   array[
     'Prioritization reasoning is explicit: user impact, effort, reversibility.',
     'Comfortable owning an ambiguous surface end to end with light supervision.',
     'Pressed on our success metrics - wants to be measured on outcomes, not output.'
   ]),

  ('Who Interview', 0, 3.9,
   'AI-conducted structured Who interview. Chronological walkthrough of the last three roles, scored against the target competencies. Consistent picture: steady progression and no unexplained gaps.',
   array[
     'Highs and lows per role were consistent with what the recruiter screen surfaced.',
     'Self-reported strongest at interaction design, weakest at quantitative research.',
     'Transcript flagged one vague answer on why they left the second role.'
   ]),
  ('Who Interview', 1, 3.4,
   'AI-conducted structured Who interview. Coverage complete but the signal is mixed - several answers stayed at the level of responsibilities rather than outcomes.',
   array[
     'Difficulty naming a measurable outcome for two of the three roles.',
     'Enthusiastic about the domain, though the explanation of legal workflows stayed surface-level.',
     'Recommend the technical interview probe workflow complexity directly.'
   ]),
  ('Who Interview', 2, 4.3,
   'AI-conducted structured Who interview. Strong, specific answers across every competency, with a concrete outcome attached to each role.',
   array[
     'Named the metric moved in each of the last three roles.',
     'Described stakeholder tradeoffs in a compliance review with real detail.',
     'No inconsistencies against the resume timeline.'
   ]),

  ('Technical Interview', 0, 4.2,
   'Technical and craft interview. Whiteboard exercise on a multi-step document review flow. Handled error states and progressive disclosure well; design-system thinking is mature.',
   array[
     'Mapped the happy path and three edge cases before touching any UI.',
     'Good instincts on surfacing model confidence - proposed a review queue with explainability.',
     'Component thinking is strong; raised tokens, theming and accessibility unprompted.'
   ]),
  ('Technical Interview', 1, 3.6,
   'Technical and craft interview. Competent execution, but the exercise stayed shallow on edge cases and the AI-output surface was handled generically.',
   array[
     'Information architecture was sound; error and empty states were an afterthought.',
     'Human-in-the-loop patterns are unfamiliar - defaulted to a plain confirmation dialog.',
     'Figma craft is high and iteration speed during the session was good.'
   ]),
  ('Technical Interview', 2, 4.6,
   'Technical and craft interview. Best exercise in the loop so far - decomposed a dense matter-management workflow and defended every tradeoff with a user need or a constraint.',
   array[
     'Explicitly designed for model uncertainty: confidence bands plus an audit trail.',
     'Balanced density and clarity with a layered progressive-disclosure pattern.',
     'Proposed how the new patterns would fold back into the design system.'
   ]),

  ('Panel Interview', 0, 4.0,
   'Panel interview across design, product and engineering. Consistent positive read on collaboration and craft; one panelist wants more evidence of driving alignment.',
   array[
     'Design and product recommend hire; engineering leans hire with reservations on scope.',
     'Handled conflicting panel feedback calmly and asked clarifying questions.',
     'Follow-up: share a written rationale for the exercise decisions.'
   ]),
  ('Panel Interview', 1, 3.8,
   'Panel interview. Mixed but net positive - strong with design and engineering, less convincing with the product partner on prioritization.',
   array[
     'Prioritization answers were user-first but light on business framing.',
     'Rapport with engineering was immediate; spoke their language on constraints.',
     'No blockers raised; recommend a reference check before an offer.'
   ]),
  ('Panel Interview', 2, 4.5,
   'Panel interview. Unanimous positive. The panel highlighted problem framing, composure under challenge and a clear sense of ownership.',
   array[
     'All three panelists independently recommended hire.',
     'Advocated for a user need against a business shortcut and made it persuasive.',
     'Ready for an offer conversation; no outstanding concerns.'
   ])
),
inserted as (
  insert into public.application_stage_evaluations (
    application_id, sub_stage_id, status, interviewer_id, interview_date, mode, rubric_score, summary
  )
  select
    p.application_id,
    p.sub_stage_id,
    'completed'::eval_status,
    -- AI-run stages have no team member to attribute the evaluation to.
    case
      when p.stage_name in ('Pre-Screening', 'Who Interview') then null
      else (
        select tm.id
        from public.job_team_members tm
        where tm.job_id = p.job_id
          and tm.role = case
            when p.stage_name in ('Recruiter Screen', 'HR Interview') then 'Recruiter'
            else 'Hiring Manager'
          end
        order by tm.created_at
        limit 1
      )
    end,
    -- Older stages sit further in the past, so the loop reads chronologically.
    now()
      - (p.steps_back * interval '6 days')
      - ((p.app_idx % 4) * interval '11 hours'),
    p.format,
    c.score,
    c.summary
  from prior_stage p
  join stage_copy c
    on c.stage_name = p.stage_name
   and c.variant = p.app_idx % 3
  returning id, application_id, sub_stage_id
)
insert into public.application_stage_evaluation_notes (evaluation_id, note, display_order)
select
  i.id,
  n.note,
  (n.ord - 1)::int
from inserted i
join prior_stage p
  on p.application_id = i.application_id
 and p.sub_stage_id = i.sub_stage_id
join stage_copy c
  on c.stage_name = p.stage_name
 and c.variant = p.app_idx % 3
cross join lateral unnest(c.notes) with ordinality as n(note, ord);
