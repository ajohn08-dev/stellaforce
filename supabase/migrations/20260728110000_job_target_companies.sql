-- ─────────────────────────────────────────────────────────────────────────────
-- Target Companies for a job — companies to source candidates from, either
-- extracted from the recruiter's notes or AI-suggested (similar companies in
-- the same space). Part of the Role Definition step.
-- ─────────────────────────────────────────────────────────────────────────────

create table job_target_companies (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references job_orders(job_id) on delete cascade,
  name       text not null,
  source     text not null default 'ai_suggested',  -- 'extracted' | 'ai_suggested' | 'recruiter'
  created_at timestamptz not null default now(),
  unique (job_id, name)
);

create index idx_job_target_companies_job on job_target_companies(job_id);

alter table job_target_companies enable row level security;
create policy "recruiters_all_job_target_companies" on job_target_companies
  for all to authenticated using (true) with check (true);
