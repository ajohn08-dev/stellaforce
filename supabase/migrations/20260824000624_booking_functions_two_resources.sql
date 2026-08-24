-- The booking transaction, for either resource.
--
-- Unchanged: advisory lock is the mechanism, EXCLUDE is the invariant, lock order
-- is request-then-resource, reason codes are returned not RAISEd, no network I/O.
--
-- What differs is only how "is this slot free" is answered:
--   agent       — the lowest free lane below its concurrency limit
--   interviewer — capacity 1, so simply: is anything overlapping?
--
-- The advisory lock key is namespaced per resource kind, so an agent and an
-- interviewer with colliding uuid hashes cannot serialise against each other.
--
-- ⚠️ This migration as APPLIED also replaced `confirm_interview_booking`, with a
-- version that shipped a `text` vs `interviewer_type` bug — every agent booking
-- raised 42804. It was replaced four minutes later by
-- 20260824001248_fix_confirm_booking_interviewer_type_cast, which is the only
-- version anything ever ran successfully. The broken definition is deliberately
-- omitted here rather than preserved and immediately overwritten: replaying
-- these files reaches the identical end state, and two near-identical 150-line
-- functions in the history would obscure rather than record.

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
  v_taken   boolean;
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
  if p_starts_at < now() + make_interval(mins => r.minimum_notice_minutes)
     or p_starts_at > now() + make_interval(days => r.booking_horizon_days) then
    return query select null::uuid, null::timestamptz, null::timestamptz,
                        null::timestamptz, 'NO_BOOKABLE_AGENT_SLOT'; return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    case when r.agent_id is not null
         then 'sf_agent_lane:' || r.agent_id::text
         else 'sf_interviewer:' || r.interviewer_member_id::text end, 0));

  -- An EXCLUDE predicate cannot call now(), so an expired hold still occupies
  -- its slot at the index level until deleted.
  delete from public.interview_slot_holds as h
   where h.expires_at <= now()
     and (h.agent_id = r.agent_id or h.interviewer_member_id = r.interviewer_member_id);

  v_end   := p_starts_at + make_interval(mins => r.slot_minutes);
  v_range := tstzrange(p_starts_at, v_end, '[)');

  if r.agent_id is not null then
    select min(ix)::smallint into v_lane from (
      select generate_series(0, r.agent_concurrency_limit - 1) as ix
      except
      select i.agent_slot_index from public.interviews i
       where i.agent_id = r.agent_id
         and i.status in ('scheduled','in_progress') and i.during && v_range
      except
      select s.agent_slot_index from public.interview_slot_holds s
       where s.agent_id = r.agent_id and s.during && v_range and s.request_id <> r.id
    ) free;
    if v_lane is null then
      return query select null::uuid, null::timestamptz, null::timestamptz,
                          null::timestamptz, 'SLOT_ALREADY_TAKEN'; return;
    end if;
  else
    -- Capacity 1: one person, one interview. Their own live bookings and anyone
    -- else's hold on them both count.
    select exists (
      select 1 from public.interviews i
       where i.interviewer_member_id = r.interviewer_member_id
         and i.status in ('scheduled','in_progress') and i.during && v_range
      union all
      select 1 from public.interview_slot_holds s
       where s.interviewer_member_id = r.interviewer_member_id
         and s.during && v_range and s.request_id <> r.id
    ) into v_taken;
    if v_taken then
      return query select null::uuid, null::timestamptz, null::timestamptz,
                          null::timestamptz, 'SLOT_ALREADY_TAKEN'; return;
    end if;
    v_lane := null;
  end if;

  v_expires := now() + make_interval(secs => r.hold_seconds);

  insert into public.interview_slot_holds as h
    (request_id, agent_id, interviewer_member_id, starts_at, ends_at,
     agent_slot_index, expires_at)
  values (r.id, r.agent_id, r.interviewer_member_id, p_starts_at, v_end,
          v_lane, v_expires)
  on conflict (request_id) do update
    set starts_at = excluded.starts_at, ends_at = excluded.ends_at,
        agent_slot_index = excluded.agent_slot_index, expires_at = excluded.expires_at
  returning h.id into v_id;

  return query select v_id, p_starts_at, v_end, v_expires, null::text;
end $$;

revoke all on function public.hold_interview_slot(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.hold_interview_slot(uuid, timestamptz) to service_role;
