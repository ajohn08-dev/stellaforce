-- ─────────────────────────────────────────────────────────────────────────────
-- Resume ingestion pipeline: move persistence for the n8n resume-parsing
-- webhook out of n8n and into a single Next.js write path (route handler +
-- service layer). This migration adds:
--   1. `ingestion_jobs` — one row per webhook delivery, keyed by storage_path
--      so retried/duplicate deliveries are a no-op (idempotency).
--   2. Unique constraints so per-candidate child rows can be upserted with
--      onConflict instead of blind inserts (prevents duplicates on retry).
--   3. `source_resume_id` on work experiences / education / certifications so
--      a reprocess can safely replace only the rows a given resume produced,
--      never touching recruiter-entered rows (source_resume_id is null there).
--   4. `resumes.parse_status` gains `needs_review` for incomplete/suspicious
--      parses that shouldn't hard-fail the ingestion.
-- ─────────────────────────────────────────────────────────────────────────────

-- (1) ingestion_jobs ----------------------------------------------------------

create table ingestion_jobs (
  id                   uuid primary key default gen_random_uuid(),

  -- idempotency key: one uploaded file = one job, no matter how many times
  -- n8n retries the callback.
  storage_path         text not null unique,
  filename             text not null,
  user_id              uuid references profiles(id) on delete set null, -- uploader

  status               text not null default 'received'
                       check (status in ('received', 'processing', 'completed', 'failed', 'needs_review')),
  stage                text,        -- last stage reached, e.g. 'upsert_candidate', 'upsert_skills'
  error_message        text,
  needs_review_reasons text[],

  candidate_id         uuid references candidates(candidate_id) on delete set null,
  resume_id            uuid references resumes(id) on delete set null,

  attempt_count        int not null default 1,
  webhook_execution_mode text,
  raw_payload          jsonb not null, -- full validated webhook item, for audit/replay

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index ingestion_jobs_candidate_id_idx on ingestion_jobs(candidate_id);
create index ingestion_jobs_status_idx on ingestion_jobs(status);

create trigger trg_ingestion_jobs_updated
  before update on ingestion_jobs
  for each row execute function set_updated_at();

alter table ingestion_jobs enable row level security;

create policy "ingestion_jobs: authenticated read/write"
  on ingestion_jobs for all
  to authenticated
  using (true)
  with check (true);

-- (2) unique constraints for safe upserts -------------------------------------

alter table resumes
  add constraint resumes_storage_path_key unique (storage_path);

create unique index candidate_links_candidate_id_url_key
  on candidate_links(candidate_id, url);

create unique index candidate_skills_candidate_id_skill_id_key
  on candidate_skills(candidate_id, skill_id);

create unique index candidate_tools_candidate_id_tool_id_key
  on candidate_tools(candidate_id, tool_id);

-- (3) source_resume_id for safe reprocessing ----------------------------------

alter table candidate_work_experiences
  add column source_resume_id uuid references resumes(id) on delete set null;

alter table candidate_education
  add column source_resume_id uuid references resumes(id) on delete set null;

alter table candidate_certifications
  add column source_resume_id uuid references resumes(id) on delete set null;

create index candidate_work_experiences_source_resume_id_idx
  on candidate_work_experiences(source_resume_id);
create index candidate_education_source_resume_id_idx
  on candidate_education(source_resume_id);
create index candidate_certifications_source_resume_id_idx
  on candidate_certifications(source_resume_id);

-- (4) needs_review parse status -----------------------------------------------

alter table resumes drop constraint resumes_parse_status_check;
alter table resumes add constraint resumes_parse_status_check
  check (parse_status in ('pending', 'parsed', 'failed', 'needs_review'));
