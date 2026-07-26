create table resumes (
  id             uuid primary key default gen_random_uuid(),
  candidate_id   uuid not null references candidates(candidate_id) on delete cascade,

  -- file reference (bytes live in the 'resumes' Storage bucket, never in this table)
  storage_path   text not null,                         -- e.g. {candidate_id}/{timestamp}-{filename} within the 'resumes' bucket
  filename       text not null,
  file_size      bigint,
  mime_type      text,

  -- parsing
  parsed_data    jsonb,                                 -- structured LLM output from n8n
  parse_status   text not null default 'pending'        -- pending | parsed | failed
                 check (parse_status in ('pending','parsed','failed')),
  parse_error    text,                                  -- message if parse_status = 'failed'

  -- versioning / soft replace
  is_current     boolean not null default true,         -- only one true per candidate
  version        int not null default 1,
  superseded_at  timestamptz,                           -- set when this resume stops being current

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index resumes_candidate_id_idx on resumes(candidate_id);

-- Enforce "only one current resume per candidate" at the DB level, not just in app code.
create unique index resumes_one_current_per_candidate
  on resumes(candidate_id)
  where is_current;

-- Reuse the existing generic updated_at trigger function (defined in 0002_core_tables.sql).
create trigger trg_resumes_updated
  before update on resumes
  for each row execute function set_updated_at();

-- Matches this schema's standard RLS convention: permissive for any
-- authenticated user, same as every other V3.2 table (profiles is the only
-- exception). Resume file *access* is already gated at the Storage layer
-- (Stellaforce-side read; owning-uploader write, being updated below).
alter table resumes enable row level security;

create policy "resumes: authenticated read/write"
  on resumes for all
  to authenticated
  using (true)
  with check (true);
