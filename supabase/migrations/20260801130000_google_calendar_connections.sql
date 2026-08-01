-- ─────────────────────────────────────────────────────────────────────────────
-- Google Calendar team-member consent flow.
--
-- One connection per person, keyed by lower(email) so a profile-based team
-- member (profiles.email) and an ad-hoc invitee (job_team_members.email) are
-- looked up the same way. Holds an encrypted OAuth refresh token — service-role
-- only (no RLS policy for `authenticated`), since only server actions/route
-- handlers touch this table; Server Components only ever read a derived
-- connected/not-connected boolean, never the row itself.
-- ─────────────────────────────────────────────────────────────────────────────

create table google_calendar_connections (
  id                       uuid primary key default gen_random_uuid(),
  email                    text not null,
  profile_id               uuid references profiles(id) on delete set null,
  google_account_email     text not null,
  refresh_token_encrypted  text not null,
  scope                    text not null,
  connected_at             timestamptz not null default now(),
  revoked_at               timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create unique index idx_google_calendar_connections_email_ci
  on google_calendar_connections (lower(email));

create index idx_google_calendar_connections_profile
  on google_calendar_connections (profile_id);

create trigger set_google_calendar_connections_updated_at
  before update on google_calendar_connections
  for each row execute function set_updated_at();

alter table google_calendar_connections enable row level security;
-- Deliberately no policy: RLS with zero policies denies all access to
-- `authenticated`/`anon`; only the service-role client (admin.ts) can read or
-- write this table.

alter type activity_event_type add value 'job_team_member_added';
alter type activity_event_type add value 'calendar_connected';
alter type activity_event_type add value 'calendar_connection_revoked';
