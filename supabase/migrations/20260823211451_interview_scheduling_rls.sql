-- ── interviews: recruiter-visible, so the standard tenant pair, verbatim in
--    shape from 20260728100500.
alter table public.interviews enable row level security;

create policy "tenant_read_interviews" on public.interviews
  for select to authenticated
  using (
    public.current_profile_side() = 'stellaforce'
    or client_id = public.current_profile_client_id()
  );

create policy "tenant_write_interviews" on public.interviews
  for all to authenticated
  using (
    public.current_profile_side() = 'stellaforce'
    or client_id = public.current_profile_client_id()
  )
  with check (
    public.current_profile_side() = 'stellaforce'
    or client_id = public.current_profile_client_id()
  );

-- ── The other three: RLS enabled with ZERO policies = service-role only.
--    Exactly the google_calendar_connections precedent (20260801130000).
--
--    interview_scheduling_requests holds a link capability's hash; a slot hold
--    is a transient lock nobody renders; scheduled_agent_calls is a queue that
--    carries the context for dialling a real person. None of the three has a
--    legitimate reader holding a browser session — they are written and read by
--    the admin client, from the public booking route and the cron.
alter table public.interview_scheduling_requests enable row level security;
alter table public.interview_slot_holds          enable row level security;
alter table public.scheduled_agent_calls         enable row level security;

comment on table public.interview_scheduling_requests is
  'Service-role only (RLS on, no policies). Holds a booking token hash. '
  'Recruiters read interview_scheduling_request_status instead, which omits it.';
comment on table public.interview_slot_holds is
  'Service-role only (RLS on, no policies). A TTL''d lease on an agent lane.';
comment on table public.scheduled_agent_calls is
  'Service-role only (RLS on, no policies). The durable outbound agent-call queue.';

-- ── …but a recruiter still needs "link sent, expires Thursday".
--
--    A view that is deliberately NOT security_invoker runs as its owner and so
--    reads past the base table's RLS — which is why the tenant filter is
--    written INTO it, and token_hash simply is not selected.
--
--    Chosen over `revoke select (token_hash)` on the base table because a
--    column-level revoke makes PostgREST's `select("*")` — used throughout
--    src/lib/data.ts — start failing at runtime instead of at review time.
create view public.interview_scheduling_request_status
with (security_invoker = false) as
  select r.id, r.application_id, r.sub_stage_id, r.client_id, r.candidate_id,
         r.job_id, r.agent_id, r.status, r.token_issued_at, r.token_expires_at,
         r.slot_minutes, r.slot_granularity_minutes, r.minimum_notice_minutes,
         r.booking_horizon_days, r.hold_seconds, r.allow_start_now,
         r.agent_concurrency_limit, r.operating_timezone, r.operating_start_hour,
         r.operating_end_hour, r.operating_days,
         r.interview_id, r.booked_at, r.candidate_timezone,
         r.failure_reason_code, r.failure_event_id, r.dispatched_to_n8n_at,
         r.created_by, r.created_at, r.updated_at
    from public.interview_scheduling_requests r
   where public.current_profile_side() = 'stellaforce'
      or r.client_id = public.current_profile_client_id();

revoke all on public.interview_scheduling_request_status from public, anon;
grant select on public.interview_scheduling_request_status to authenticated;

comment on view public.interview_scheduling_request_status is
  'Recruiter-facing projection of interview_scheduling_requests with token_hash '
  'omitted. security_invoker = false on purpose: the base table has no policies, '
  'so the tenant filter lives in the WHERE clause here.';
