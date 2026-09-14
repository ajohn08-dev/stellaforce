-- Let the outbox be told "this event is real, but nothing should act on it".
--
-- When an account's automations are off the platform must keep WRITING every
-- event -- the timeline is the record, and the whole point is that a recruiter
-- can still see what would have happened -- while n8n drains none of them.
--
-- `dispatched_at` is deliberately NOT reused for this. It is the shared outbox
-- marker for a dozen event-driven workflows and its documented meaning is
-- "some workflow consumed this" (see src/lib/server/activity.ts and n8n.md).
-- Stamping it here would make "dispatched" mean "never dispatched", which is
-- the kind of overload that breaks consumers silently and years later.

alter table public.activity_events
  add column suppressed_at     timestamptz,
  add column suppressed_reason text;

comment on column public.activity_events.suppressed_at is
  'Set when the event was written while the account was not running automations. '
  'The row is a normal, readable part of the timeline -- only the outbox drain '
  'skips it. Orthogonal to dispatched_at, which still means "a workflow '
  'consumed this" and which nothing in the app may set.';

comment on column public.activity_events.suppressed_reason is
  'Why it was suppressed, e.g. automations_off | automations_paused. Free text '
  'rather than an enum: this is an explanation for a human reading the feed, '
  'not a value anything branches on.';

-- The outbox drain becomes "undispatched AND not suppressed". Replacing the
-- index rather than adding one keeps a single index behind that one query.
drop index if exists public.idx_activity_events_undispatched;
create index idx_activity_events_undispatched
  on public.activity_events (created_at)
  where dispatched_at is null and suppressed_at is null;

-- The catch-up queue's query: what was skipped, newest first.
create index idx_activity_events_suppressed
  on public.activity_events (suppressed_at)
  where suppressed_at is not null;
