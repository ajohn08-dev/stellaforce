-- The Sales Executive job at Stellaforce, created and published.
--
-- This replicates `publishJob` (src/app/(app)/jobs/actions.ts) rather than
-- calling it, because a Server Action needs a session. The sub-stage snapshot
-- mirrors `snapshotRowFromTemplateStage` field for field — if that function
-- gains a column, this job will not have it.
--
-- The wizard's competency and scorecard steps are skipped deliberately: both go
-- through n8n AI webhooks, and publish is gated on rows those webhooks produce.
-- Seeding them directly is what makes this reproducible.

-- ── 1. The job, as a draft ────────────────────────────────────────────────
insert into public.job_orders (
  job_id, title, client_id, status, location, workplace_type, office_location,
  company, industry, job_function, employment_type, experience_required,
  education_required, salary_from, salary_to, salary_currency, description
)
values (
  '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92',
  'Sales Executive',
  'c1e0f4a2-6d3b-4f8e-9a17-2b5c8d0e7f31',
  'draft',
  'Charleston, SC',
  'hybrid',
  'Charleston, South Carolina',
  'Stellaforce',
  'AI & agentic recruiting technology',
  'Sales',
  'full-time',
  '5-7 years',
  null,
  120000, 160000, 'USD',
  'Sell Stellaforce''s agentic recruiting platform to mid-market B2B companies. Own the full cycle — prospecting, discovery, multi-stakeholder demos, commercial terms and contract close — reporting directly to the Sales Director. Based in Charleston, SC: the team meets in person regularly and a meaningful share of customer conversations happen face to face.'
)
on conflict (job_id) do nothing;

-- ── 2. Competencies ───────────────────────────────────────────────────────
insert into public.job_competencies (id, job_id, type, description, recommended_level, skills, tools)
values
  ('a1000000-0000-4000-8000-000000000001', '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92', 'technical',
   'Runs a full B2B SaaS sales cycle end to end — prospecting, qualification, demo, commercial negotiation and close — against a quota.',
   'expert', array['Full-cycle sales','Pipeline management','Forecasting'], array['Salesforce','Outreach']),
  ('a1000000-0000-4000-8000-000000000002', '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92', 'hybrid',
   'Builds and negotiates commercial contracts: pricing, terms, procurement and legal review, without losing the deal or the margin.',
   'proficient', array['Contract negotiation','Commercial terms','Procurement navigation'], array['DocuSign']),
  ('a1000000-0000-4000-8000-000000000003', '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92', 'behavioral',
   'Develops a mid-market territory from a standing start — segmentation, outbound motion, and a repeatable source of new pipeline.',
   'proficient', array['Territory planning','Outbound prospecting'], array['LinkedIn Sales Navigator']),
  ('a1000000-0000-4000-8000-000000000004', '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92', 'behavioral',
   'Runs consultative discovery: finds the real problem, quantifies it, and earns access to the people who decide.',
   'expert', array['Discovery','Value selling','Objection handling'], array[]::text[]),
  ('a1000000-0000-4000-8000-000000000005', '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92', 'leadership',
   'Holds their own with executive stakeholders on both sides — customer economic buyers, and a Sales Director they work to directly.',
   'proficient', array['Executive presence','Stakeholder management'], array[]::text[])
on conflict (id) do nothing;

-- ── 3. Scorecard. `unique(competency_id)` — one category per competency. ──
insert into public.job_scorecard_categories (id, job_id, name, weight)
values
  ('b1000000-0000-4000-8000-000000000001', '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92', 'Sales execution', 40),
  ('b1000000-0000-4000-8000-000000000002', '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92', 'Commercial judgement', 35),
  ('b1000000-0000-4000-8000-000000000003', '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92', 'Stakeholder impact', 25)
on conflict (id) do nothing;

insert into public.job_scorecard_category_competencies (category_id, competency_id)
values
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003'),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002'),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000004'),
  ('b1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000005')
on conflict do nothing;

-- ── 4. The hiring team ────────────────────────────────────────────────────
-- ⚠️ Only annaj@stellaforce.com has a connected Google Calendar, so the Sales
-- Director's two stages resolve as bookable but will offer no slots until they
-- connect one.
insert into public.job_team_members (id, job_id, name, email, role)
values
  ('c2000000-0000-4000-8000-000000000001', '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92',
   'Marcus Reyes', 'sales.director@stellaforce.com', 'Sales Director'),
  ('c2000000-0000-4000-8000-000000000002', '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92',
   'Anna John', 'annaj@stellaforce.com', 'Recruiter')
on conflict (id) do nothing;
