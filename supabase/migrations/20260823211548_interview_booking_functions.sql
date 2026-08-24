-- The booking transaction.
--
-- pg_advisory_xact_lock keyed on agent_id is the MECHANISM; the EXCLUDE
-- constraints are the INVARIANT. The constraints cannot be primary: Postgres has
-- no cross-table exclusion, and a hold must not overlap an interview. And
-- capacity is N, not 1 — assigning the lowest free lane is itself the
-- read-then-write race the constraint was meant to prevent.
--
-- Lock order is fixed in every function below: request row FOR UPDATE, then the
-- agent advisory lock. Never the reverse, so deadlock is structurally impossible.
--
-- Reason codes are RETURNED, never RAISEd: a RAISE aborts the transaction and
-- PostgREST surfaces an opaque P0001 the caller has to regex. A returned row
-- lets the caller decide which failures become alerts.
--
-- ⚠️ These functions must contain NO network I/O. Every seeded agent currently
-- points at one ElevenLabs agent, so every confirm in the system serializes on
-- one advisory lock; the n8n POST happens after commit, in the Server Action.
--
-- NOTE: hold_interview_slot below shipped with a variable/column ambiguity bug
-- (its OUT params shadow interview_slot_holds columns of the same name) and is
-- replaced wholesale by 20260823211822_fix_hold_interview_slot_column_ambiguity.

-- ═══════════════════════════════════════════════════════════════════════════
-- hold_interview_slot — take (or move) this request's single lease.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.hold_interview_slot(
  p_request_id uuid,
  p_starts_at  timestamptz
)
returns table (
  hold_id     uuid,
  starts_at   timestamptz,
  ends_at     timestamptz,
  expires_at  timestamptz,
  reason_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r         public.interview_scheduling_requests%rowtype;
  v_end     timestamptz;
  v_range   tstzrange;
  v_lane    smallint;
  v_expires timestamptz;
  v_id      uuid;
begin
  select * into r from public.interview_scheduling_requests
   where id = p_request_id for update;

  if not found then
    return query select null::uuid, null::timestamptz, null::timestamptz,
                        null::timestamptz, 'CANDIDATE_BOOKING_TOKEN_INVALID'; return;
  end if;
  if r.status = 'booked' then
    return query select null::uuid, null::timestamptz, null::timestamptz,
                        null::timestamptz, 'CANDIDATE_ALREADY_BOOKED'; return;
  end if;
  if r.status not in ('pending','sent') or r.token_expires_at <= now() then
    return query select null::uuid, null::timestamptz, null::timestamptz,
                        null::timestamptz, 'CANDIDATE_BOOKING_TOKEN_EXPIRED'; return;
  end if;

  if p_starts_at < now() + make_interval(mins => r.minimum_notice_minutes) then
    return query select null::uuid, null::timestamptz, null::timestamptz,
                        null::timestamptz, 'NO_BOOKABLE_AGENT_SLOT'; return;
  end if;
  if p_starts_at > now() + make_interval(days => r.booking_horizon_days) then
    return query select null::uuid, null::timestamptz, null::timestamptz,
                        null::timestamptz, 'NO_BOOKABLE_AGENT_SLOT'; return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('sf_agent_lane:' || r.agent_id::text, 0));

  delete from public.interview_slot_holds
   where agent_id = r.agent_id and expires_at <= now();

  v_end   := p_starts_at + make_interval(mins => r.slot_minutes);
  v_range := tstzrange(p_starts_at, v_end, '[)');

  select min(ix)::smallint into v_lane from (
    select generate_series(0, r.agent_concurrency_limit - 1) as ix
    except
    select i.agent_slot_index from public.interviews i
     where i.agent_id = r.agent_id
       and i.status in ('scheduled','in_progress')
       and i.during && v_range
    except
    select s.agent_slot_index from public.interview_slot_holds s
     where s.agent_id = r.agent_id
       and s.during && v_range
       and s.request_id <> r.id
  ) free;

  if v_lane is null then
    return query select null::uuid, null::timestamptz, null::timestamptz,
                        null::timestamptz, 'SLOT_ALREADY_TAKEN'; return;
  end if;

  v_expires := now() + make_interval(secs => r.hold_seconds);

  insert into public.interview_slot_holds
    (request_id, agent_id, starts_at, ends_at, agent_slot_index, expires_at)
  values (r.id, r.agent_id, p_starts_at, v_end, v_lane, v_expires)
  on conflict (request_id) do update
    set starts_at        = excluded.starts_at,
        ends_at          = excluded.ends_at,
        agent_slot_index = excluded.agent_slot_index,
        expires_at       = excluded.expires_at
  returning id into v_id;

  return query select v_id, p_starts_at, v_end, v_expires, null::text;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- confirm_interview_booking — the atomic commit.
--
-- Takes a REQUEST ID, never the raw token: the secret must not enter a SQL
-- statement, where it would land in pg_stat_statements and the query log.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.confirm_interview_booking(
  p_request_id         uuid,
  p_hold_id            uuid,
  p_candidate_timezone text,
  p_start_now          boolean default false
)
returns table (
  interview_id      uuid,
  scheduled_call_id uuid,
  scheduled_at      timestamptz,
  ends_at           timestamptz,
  agent_slot_index  smallint,
  reason_code       text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r       public.interview_scheduling_requests%rowtype;
  h       public.interview_slot_holds%rowtype;
  v_start timestamptz;
  v_end   timestamptz;
  v_range tstzrange;
  v_lane  smallint;
  v_iv    uuid;
  v_call  uuid;
  v_run   timestamptz;
begin
  -- (1) Serialize every writer for THIS request. Two clicks of Confirm queue
  --     here; the second sees status='booked' and returns idempotently.
  select * into r from public.interview_scheduling_requests
   where id = p_request_id for update;

  if not found then
    return query select null::uuid, null::uuid, null::timestamptz, null::timestamptz,
                        null::smallint, 'CANDIDATE_BOOKING_TOKEN_INVALID'; return;
  end if;

  if r.status = 'booked' then
    -- Not an error to the candidate: re-show the booking they already have. The
    -- code is still returned so the caller can decide not to alert on it.
    return query select r.interview_id, null::uuid, null::timestamptz, null::timestamptz,
                        null::smallint, 'CANDIDATE_ALREADY_BOOKED'; return;
  end if;

  if r.status not in ('pending','sent') or r.token_expires_at <= now() then
    return query select null::uuid, null::uuid, null::timestamptz, null::timestamptz,
                        null::smallint, 'CANDIDATE_BOOKING_TOKEN_EXPIRED'; return;
  end if;

  if p_start_now and not r.allow_start_now then
    return query select null::uuid, null::uuid, null::timestamptz, null::timestamptz,
                        null::smallint, 'SCHEDULING_CONFIGURATION_INVALID'; return;
  end if;

  -- (2) Serialize every writer for THIS AGENT. Cross-table capacity cannot be
  --     a constraint, so it is a lock.
  perform pg_advisory_xact_lock(
    hashtextextended('sf_agent_lane:' || r.agent_id::text, 0));

  -- (3) Self-clean before reading lanes. An EXCLUDE predicate cannot call now(),
  --     so an expired hold still occupies its lane at the index level.
  delete from public.interview_slot_holds
   where agent_id = r.agent_id and expires_at <= now();

  -- (4) Resolve the instant.
  if p_start_now then
    v_start := date_trunc('second', now());
  else
    select * into h from public.interview_slot_holds
     where id = p_hold_id and request_id = r.id;
    if not found then
      -- Never existed, belonged to another request, or was just swept by (3).
      return query select null::uuid, null::uuid, null::timestamptz, null::timestamptz,
                          null::smallint, 'SLOT_HOLD_EXPIRED'; return;
    end if;
    v_start := h.starts_at;
    -- A hold taken at the very edge of the notice window can age past it while
    -- the candidate reads the confirm screen.
    if v_start < now() + make_interval(mins => r.minimum_notice_minutes) then
      delete from public.interview_slot_holds where id = h.id;
      return query select null::uuid, null::uuid, null::timestamptz, null::timestamptz,
                          null::smallint, 'SLOT_HOLD_EXPIRED'; return;
    end if;
  end if;

  v_end   := v_start + make_interval(mins => r.slot_minutes);
  v_range := tstzrange(v_start, v_end, '[)');

  -- (5) Lowest lane free across both tables, excluding our own hold.
  select min(ix)::smallint into v_lane from (
    select generate_series(0, r.agent_concurrency_limit - 1) as ix
    except
    select i.agent_slot_index from public.interviews i
     where i.agent_id = r.agent_id
       and i.status in ('scheduled','in_progress')
       and i.during && v_range
    except
    select s.agent_slot_index from public.interview_slot_holds s
     where s.agent_id = r.agent_id
       and s.during && v_range
       and s.id is distinct from p_hold_id
  ) free;

  if v_lane is null then
    return query select null::uuid, null::uuid, null::timestamptz, null::timestamptz,
                        null::smallint,
                        case when p_start_now then 'AGENT_CAPACITY_UNAVAILABLE'
                             else 'SLOT_ALREADY_TAKEN' end; return;
  end if;

  -- (6) Commit. Everything from here is one transaction: an interview with no
  --     queued call, or a queued call with no interview, are both states nothing
  --     in this system can recover from.
  insert into public.interviews (
    application_id, sub_stage_id, client_id, candidate_id, job_id,
    scheduling_request_id, status, interviewer_type, agent_id,
    scheduled_at, ends_at, agent_slot_index, candidate_timezone, started_now
  ) values (
    r.application_id, r.sub_stage_id, r.client_id, r.candidate_id, r.job_id,
    r.id, 'scheduled', 'ai', r.agent_id,
    v_start, v_end, v_lane,
    coalesce(p_candidate_timezone, r.candidate_timezone), p_start_now
  ) returning id into v_iv;

  delete from public.interview_slot_holds where request_id = r.id;

  update public.interview_scheduling_requests
     set status = 'booked',
         interview_id = v_iv,
         booked_at = now(),
         candidate_timezone = coalesce(p_candidate_timezone, candidate_timezone),
         -- The link is spent. Expiring it here is what makes the token
         -- single-use without a separate consumed_at column.
         token_expires_at = now()
   where id = r.id;

  -- 60s of lead so provider spin-up lands the call ON the slot, not after it.
  v_run := case when p_start_now then now() else v_start - interval '60 seconds' end;

  insert into public.scheduled_agent_calls (
    interview_id, agent_id, application_id, client_id, candidate_id, job_id,
    sub_stage_id, status, run_at
  ) values (
    v_iv, r.agent_id, r.application_id, r.client_id, r.candidate_id, r.job_id,
    r.sub_stage_id, 'pending', v_run
  ) returning id into v_call;

  return query select v_iv, v_call, v_start, v_end, v_lane, null::text;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- cancel_interview — interview and its queued call, one transaction.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.cancel_interview(
  p_interview_id uuid,
  p_reason       text default null
)
returns table (canceled boolean, reason_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare v_status public.interview_status;
begin
  select status into v_status from public.interviews
   where id = p_interview_id for update;
  if not found then
    return query select false, 'CANDIDATE_BOOKING_TOKEN_INVALID'; return;
  end if;
  if v_status in ('completed','canceled') then
    -- Idempotent: cancelling a cancelled interview is a no-op, not an error.
    return query select false, null::text; return;
  end if;

  update public.interviews
     set status = 'canceled', canceled_at = now(), cancel_reason = p_reason
   where id = p_interview_id;

  update public.scheduled_agent_calls
     set status = 'canceled', canceled_at = now()
   where interview_id = p_interview_id and status in ('pending','claimed');

  return query select true, null::text;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- claim_due_agent_calls — FOR UPDATE SKIP LOCKED, which PostgREST cannot express.
--
-- Re-checks the interview and application INSIDE the claim. That is what makes
-- cancellation race-proof: a cancel landing between claim and dispatch is caught
-- here, and one landing after dispatch is n8n's problem — nothing un-rings a phone.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.claim_due_agent_calls(
  p_limit         integer default 25,
  p_lease_seconds integer default 300
)
returns table (
  call_id uuid, interview_id uuid, attempts smallint, campaign_id uuid,
  application_id uuid, candidate_id uuid, client_id uuid, job_id uuid,
  sub_stage_id uuid, agent_id uuid, scheduled_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select c.id
      from public.scheduled_agent_calls c
      join public.interviews i   on i.id = c.interview_id
      join public.applications a on a.application_id = c.application_id
     where c.status = 'pending'
       and c.run_at <= now()
       and (c.locked_until is null or c.locked_until < now())
       -- A cancelled interview or a closed application can never be dialled,
       -- however its queue row got here.
       and i.status = 'scheduled'
       and a.status = 'active'
     order by c.run_at
     limit p_limit
       for update of c skip locked
  )
  update public.scheduled_agent_calls c
     set status = 'claimed',
         attempts = c.attempts + 1,
         last_attempt_at = now(),
         locked_until = now() + make_interval(secs => p_lease_seconds)
    from due, public.interviews i
   where c.id = due.id and i.id = c.interview_id
  returning c.id, c.interview_id, c.attempts, c.campaign_id,
            c.application_id, c.candidate_id, c.client_id, c.job_id,
            c.sub_stage_id, c.agent_id, i.scheduled_at;
$$;

-- Service-role only. None of these may be reachable from a browser session:
-- they bypass RLS by construction and the booking ones mutate capacity.
revoke all on function public.hold_interview_slot(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.confirm_interview_booking(uuid, uuid, text, boolean)
  from public, anon, authenticated;
revoke all on function public.cancel_interview(uuid, text)
  from public, anon, authenticated;
revoke all on function public.claim_due_agent_calls(integer, integer)
  from public, anon, authenticated;

grant execute on function public.hold_interview_slot(uuid, timestamptz) to service_role;
grant execute on function public.confirm_interview_booking(uuid, uuid, text, boolean) to service_role;
grant execute on function public.cancel_interview(uuid, text) to service_role;
grant execute on function public.claim_due_agent_calls(integer, integer) to service_role;
