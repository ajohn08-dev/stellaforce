create table call_recordings (
  id                uuid primary key default gen_random_uuid(),

  -- null for test-run recordings (storage path under test/, no real application)
  application_id    uuid references applications(application_id) on delete cascade,
  -- optional link to the specific interview evaluation, when this recording
  -- is for a human/external interview stage rather than a screening-agent call
  evaluation_id     uuid references application_stage_evaluations(id) on delete set null,

  interviewer_type  interviewer_type not null, -- ai | human | external — mirrors the storage path segment
  is_test           boolean not null default false, -- true for agent test-run calls (test/ prefix, no application)

  -- file reference (bytes live in the 'call-recordings' Storage bucket, never in this table)
  storage_path      text not null,             -- applications/{application_id}/{interviewer_type}/{timestamp}-{filename} or test/{timestamp}-{filename}
  filename          text not null,
  file_size         bigint,
  mime_type         text,
  duration_seconds  integer,

  transcript         text,
  transcript_status  text not null default 'pending'
                      check (transcript_status in ('pending','transcribed','failed')),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint call_recordings_test_has_no_application
    check (not is_test or application_id is null)
);

create unique index call_recordings_storage_path_key on call_recordings(storage_path);
create index call_recordings_application_id_idx on call_recordings(application_id);
create index call_recordings_evaluation_id_idx on call_recordings(evaluation_id);

create trigger trg_call_recordings_updated
  before update on call_recordings
  for each row execute function set_updated_at();

-- Matches the resumes-table convention: permissive for any authenticated
-- user (same as every other core V3.2 table), since real access control is
-- already enforced at the Storage layer above.
alter table call_recordings enable row level security;

create policy "call_recordings: authenticated read/write"
  on call_recordings for all
  to authenticated
  using (true)
  with check (true);
