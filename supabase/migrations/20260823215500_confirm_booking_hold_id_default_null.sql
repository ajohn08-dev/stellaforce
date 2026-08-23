-- `p_hold_id` is legitimately null for a Start-now booking: there is no slot to
-- hold when the call begins immediately. Without a DEFAULT, the generated
-- TypeScript types it as a required `string` and the caller has to lie with a
-- cast — so the default is added rather than the type worked around.
--
-- Body is unchanged from 20260823211548; only the signature's defaults differ.
-- `create or replace` cannot alter a parameter default in place, so the old
-- signature is dropped first (service-role only, one caller).
--
-- See 20260823211548_interview_booking_functions.sql for the full commentary on
-- the locking strategy; it is unchanged.
drop function if exists public.confirm_interview_booking(uuid, uuid, text, boolean);

create function public.confirm_interview_booking(
  p_request_id         uuid,
  p_hold_id            uuid default null,
  p_candidate_timezone text default null,
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
  select * into r from public.interview_scheduling_requests
   where id = p_request_id for update;

  if not found then
    return query select null::uuid, null::uuid, null::timestamptz, null::timestamptz,
                        null::smallint, 'CANDIDATE_BOOKING_TOKEN_INVALID'; return;
  end if;

  if r.status = 'booked' then
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

  perform pg_advisory_xact_lock(
    hashtextextended('sf_agent_lane:' || r.agent_id::text, 0));

  delete from public.interview_slot_holds as sh
   where sh.agent_id = r.agent_id and sh.expires_at <= now();

  if p_start_now then
    v_start := date_trunc('second', now());
  else
    select * into h from public.interview_slot_holds
     where id = p_hold_id and request_id = r.id;
    if not found then
      return query select null::uuid, null::uuid, null::timestamptz, null::timestamptz,
                          null::smallint, 'SLOT_HOLD_EXPIRED'; return;
    end if;
    v_start := h.starts_at;
    if v_start < now() + make_interval(mins => r.minimum_notice_minutes) then
      delete from public.interview_slot_holds where id = h.id;
      return query select null::uuid, null::uuid, null::timestamptz, null::timestamptz,
                          null::smallint, 'SLOT_HOLD_EXPIRED'; return;
    end if;
  end if;

  v_end   := v_start + make_interval(mins => r.slot_minutes);
  v_range := tstzrange(v_start, v_end, '[)');

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
         token_expires_at = now()
   where id = r.id;

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

revoke all on function public.confirm_interview_booking(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.confirm_interview_booking(uuid, uuid, text, boolean)
  to service_role;
