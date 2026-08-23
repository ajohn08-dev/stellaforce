-- `hold_interview_slot` declares OUT parameters named `starts_at`, `ends_at` and
-- `expires_at`. Inside a PL/pgSQL body those are variables, and they shadow the
-- columns of the same name on `interview_slot_holds` — so the self-cleaning
-- DELETE raised `42702: column reference "expires_at" is ambiguous` the first
-- time it was called.
--
-- Fixed by aliasing every table reference rather than by renaming the OUT
-- params: the names are the JSON keys PostgREST returns, and `hold_id` /
-- `starts_at` / `ends_at` / `expires_at` are what the caller wants to read.
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

  -- Notice and horizon re-checked server-side: the grid the candidate is looking
  -- at was generated at page load and may have aged past either bound.
  if p_starts_at < now() + make_interval(mins => r.minimum_notice_minutes)
     or p_starts_at > now() + make_interval(days => r.booking_horizon_days) then
    return query select null::uuid, null::timestamptz, null::timestamptz,
                        null::timestamptz, 'NO_BOOKABLE_AGENT_SLOT'; return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('sf_agent_lane:' || r.agent_id::text, 0));

  -- An EXCLUDE predicate cannot call now(), so an expired hold still occupies
  -- its lane at the index level until deleted. Aliased — see the header.
  delete from public.interview_slot_holds as h
   where h.agent_id = r.agent_id and h.expires_at <= now();

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

  -- One hold per request: a candidate clicking around MOVES their lease.
  insert into public.interview_slot_holds as h
    (request_id, agent_id, starts_at, ends_at, agent_slot_index, expires_at)
  values (r.id, r.agent_id, p_starts_at, v_end, v_lane, v_expires)
  on conflict (request_id) do update
    set starts_at        = excluded.starts_at,
        ends_at          = excluded.ends_at,
        agent_slot_index = excluded.agent_slot_index,
        expires_at       = excluded.expires_at
  returning h.id into v_id;

  return query select v_id, p_starts_at, v_end, v_expires, null::text;
end $$;

revoke all on function public.hold_interview_slot(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.hold_interview_slot(uuid, timestamptz) to service_role;
