-- ─────────────────────────────────────────────────────────────────────────────
-- V3.2 — Candidate child tables: work experience, education, certifications, links
-- ─────────────────────────────────────────────────────────────────────────────

create table candidate_work_experiences (
  id              uuid primary key default gen_random_uuid(),
  candidate_id    uuid not null references candidates(candidate_id) on delete cascade,
  display_order   integer not null,
  company_name    text not null,
  title           text not null,
  employment_type employment_type,
  location        text,
  is_remote       boolean,
  start_date      date not null,
  end_date        date,
  is_current      boolean default false,
  description     text,
  created_at      timestamptz not null default now(),
  unique (candidate_id, display_order)
);

create table candidate_education (
  id               uuid primary key default gen_random_uuid(),
  candidate_id     uuid not null references candidates(candidate_id) on delete cascade,
  institution_name text not null,
  degree           text,
  field_of_study   text,
  start_date       date,
  end_date         date,
  is_current       boolean default false,
  gpa              numeric(3,2),
  description      text,
  created_at       timestamptz not null default now()
);

create table candidate_certifications (
  id                   uuid primary key default gen_random_uuid(),
  candidate_id         uuid not null references candidates(candidate_id) on delete cascade,
  name                 text not null,
  issuing_organization text,
  issue_date           date,
  expiry_date          date,
  credential_id        text,
  credential_url       url,
  created_at           timestamptz not null default now()
);

create table candidate_links (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(candidate_id) on delete cascade,
  label        text,
  url          url not null,
  link_type    text,
  created_at   timestamptz not null default now()
);
