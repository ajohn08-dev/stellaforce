-- ─────────────────────────────────────────────────────────────────────────────
-- 0002 — Core tables + updated_at triggers
-- Every table has created_at / updated_at (trigger-managed). Domain-specific
-- timestamps (date_added, last_updated, date_applied, etc.) are kept alongside
-- them where the spec calls for them.
-- ─────────────────────────────────────────────────────────────────────────────

-- Generic trigger: bump updated_at on any UPDATE.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Candidates also maintain a domain-facing last_updated field.
create or replace function set_candidate_timestamps()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.last_updated = now();
  return new;
end;
$$;

-- Applications maintain a domain-facing date_updated field.
create or replace function set_application_timestamps()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.date_updated = now();
  return new;
end;
$$;

-- ── candidates (core) ────────────────────────────────────────────────────────
create table candidates (
  candidate_id         uuid primary key default gen_random_uuid(),
  full_name            text not null,
  contact_info         jsonb,           -- { email, phone, location, tz }
  linkedin_url         text,
  portfolio_url        text,
  current_title        text,
  current_company      text,
  years_experience     integer,
  education            jsonb,           -- [{ degree, field, institution, year }]
  certifications       jsonb,           -- [{ name, issuer, year }]
  languages            text[],
  professional_summary text,
  source               text,
  candidate_tier       candidate_tier,
  tier_rationale       text,
  embedding_vector     vector(1536),
  data_provenance      data_provenance not null default 'ai_parsed',
  freshness_score      numeric,
  last_verified        timestamptz,
  date_added           timestamptz not null default now(),
  last_updated         timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger trg_candidates_updated
  before update on candidates
  for each row execute function set_candidate_timestamps();

-- ── skills ───────────────────────────────────────────────────────────────────
create table skills (
  skill_id          uuid primary key default gen_random_uuid(),
  candidate_id      uuid not null references candidates(candidate_id) on delete cascade,
  skill_name        text not null,     -- from controlled taxonomy (see CLAUDE.md)
  skill_type        skill_type not null,
  proficiency_level proficiency_level,
  assessment_score  numeric,
  scorecard         jsonb,
  ai_literacy_signal jsonb,            -- { tool_used, how_used, measurable_outcome }
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_skills_updated
  before update on skills
  for each row execute function set_updated_at();

-- ── clients ──────────────────────────────────────────────────────────────────
create table clients (
  client_id   uuid primary key default gen_random_uuid(),
  client_name text not null,
  status      client_status not null default 'active',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_clients_updated
  before update on clients
  for each row execute function set_updated_at();

-- ── job_orders ───────────────────────────────────────────────────────────────
create table job_orders (
  job_id         uuid primary key default gen_random_uuid(),
  client_id      uuid not null references clients(client_id) on delete cascade,
  title          text not null,
  description    text,
  required_skills text[],
  salary_range   jsonb,               -- { min, max, currency, period }
  status         job_status not null default 'open',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_job_orders_updated
  before update on job_orders
  for each row execute function set_updated_at();

-- ── applications (pipeline) ──────────────────────────────────────────────────
create table applications (
  application_id    uuid primary key default gen_random_uuid(),
  candidate_id      uuid not null references candidates(candidate_id) on delete cascade,
  job_id            uuid not null references job_orders(job_id) on delete cascade,
  client_id         uuid not null references clients(client_id) on delete cascade,
  stage             application_stage not null default 'sourced',
  status_reason     text,
  human_review_flag boolean not null default false,
  date_applied      timestamptz not null default now(),
  date_updated      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (candidate_id, job_id)
);

create trigger trg_applications_updated
  before update on applications
  for each row execute function set_application_timestamps();

-- ── placements ───────────────────────────────────────────────────────────────
create table placements (
  placement_id     uuid primary key default gen_random_uuid(),
  candidate_id     uuid not null references candidates(candidate_id) on delete cascade,
  client_id        uuid not null references clients(client_id) on delete cascade,
  job_id           uuid not null references job_orders(job_id) on delete cascade,
  role_placed      text,
  salary           numeric,
  placement_date   date,
  guarantee_period text,               -- e.g. '90 days'
  status           placement_status not null default 'active',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_placements_updated
  before update on placements
  for each row execute function set_updated_at();

-- ── interactions (CRM log) ───────────────────────────────────────────────────
create table interactions (
  interaction_id           uuid primary key default gen_random_uuid(),
  candidate_id             uuid not null references candidates(candidate_id) on delete cascade,
  type                     interaction_type not null,
  body                     text,
  interaction_at           timestamptz not null default now(),
  communication_preferences jsonb,      -- { channel, cadence, do_not_contact }
  consent                  boolean not null default false,
  relationship_strength    numeric,
  nurture_status           nurture_status not null default 'active',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger trg_interactions_updated
  before update on interactions
  for each row execute function set_updated_at();

-- ── candidate_client_fit (join table — powers redeployment) ──────────────────
-- Decouples a candidate from a single role: a candidate can have a fit score
-- against many clients, enabling redeployment recommendations.
create table candidate_client_fit (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(candidate_id) on delete cascade,
  client_id    uuid not null references clients(client_id) on delete cascade,
  fit_score    numeric,
  rationale    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (candidate_id, client_id)
);

create trigger trg_candidate_client_fit_updated
  before update on candidate_client_fit
  for each row execute function set_updated_at();
