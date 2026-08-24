-- `case when … then 'ai' else 'human' end` is `text`, and
-- `interviews.interviewer_type` is the `interviewer_type` enum — Postgres will
-- not coerce it in an INSERT. Every agent booking failed with 42804 the moment
-- the two-resource version shipped.
--
-- Caught because the end-to-end script's assertion was vacuous: it checked
-- `!confirmed?.reason_code`, which is also true when the whole row is null. That
-- assertion is tightened in the same change.
--
-- This is the only version of `confirm_interview_booking` that has ever run
-- successfully against two resources; see 20260824000624 for why its immediate
-- predecessor is not preserved.
create or replace function public.confirm_interview_booking(
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
  v_taken boolean;
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
  -- Start-now is an agent affordance. A person cannot be summoned this second.
  if p_start_now and (not r.allow_start_now or r.agent_id is null) then
    return query select null::uuid, null::uuid, null::timestamptz, null::timestamptz,
                        null::smallint, 'SCHEDULING_CONFIGURATION_INVALID'; return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    case when r.agent_id is not null
         then 'sf_agent_lane:' || r.agent_id::text
         else 'sf_interviewer:' || r.interviewer_member_id::text end, 0));

  delete from public.interview_slot_holds as sh
   where sh.expires_at <= now()
     and (sh.agent_id = r.agent_id or sh.interviewer_member_id = r.interviewer_member_id);

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

  if r.agent_id is not null then
    select min(ix)::smallint into v_lane from (
      select generate_series(0, r.agent_concurrency_limit - 1) as ix
      except
      select i.agent_slot_index from public.interviews i
       where i.agent_id = r.agent_id
         and i.status in ('scheduled','in_progress') and i.during && v_range
      except
      select s.agent_slot_index from public.interview_slot_holds s
       where s.agent_id = r.agent_id and s.during && v_range
         and s.id is distinct from p_hold_id
    ) free;
    if v_lane is null then
      return query select null::uuid, null::uuid, null::timestamptz, null::timestamptz,
                          null::smallint,
                          case when p_start_now then 'AGENT_CAPACITY_UNAVAILABLE'
                               else 'SLOT_ALREADY_TAKEN' end; return;
    end if;
  else
    select exists (
      select 1 from public.interviews i
       where i.interviewer_member_id = r.interviewer_member_id
         and i.status in ('scheduled','in_progress') and i.during && v_range
      union all
      select 1 from public.interview_slot_holds s
       where s.interviewer_member_id = r.interviewer_member_id
         and s.during && v_range and s.id is distinct from p_hold_id
    ) into v_taken;
    if v_taken then
      return query select null::uuid, null::uuid, null::timestamptz, null::timestamptz,
                          null::smallint, 'SLOT_ALREADY_TAKEN'; return;
    end if;
    v_lane := null;
  end if;

  insert into public.interviews (
    application_id, sub_stage_id, client_id, candidate_id, job_id,
    scheduling_request_id, status, interviewer_type, agent_id, interviewer_member_id,
    scheduled_at, ends_at, agent_slot_index, candidate_timezone, started_now
  ) values (
    r.application_id, r.sub_stage_id, r.client_id, r.candidate_id, r.job_id,
    r.id, 'scheduled',
    -- The cast is the fix. Without it this is `text` and the INSERT raises 42804.
    (case when r.agent_id is not null then 'ai' else 'human' end)::public.interviewer_type,
    r.agent_id, r.interviewer_member_id,
    v_start, v_end, coalesce(v_lane, 0),
    coalesce(p_candidate_timezone, r.candidate_timezone), p_start_now
  ) returning id into v_iv;

  delete from public.interview_slot_holds where request_id = r.id;

  update public.interview_scheduling_requests
     set status = 'booked', interview_id = v_iv, booked_at = now(),
         candidate_timezone = coalesce(p_candidate_timezone, candidate_timezone),
         token_expires_at = now()
   where id = r.id;

  -- Only an agent gets dialled. A human interview produces no queue row —
  -- n8n writes the calendar event off `interview_scheduled` instead.
  if r.agent_id is not null then
    v_run := case when p_start_now then now() else v_start - interval '60 seconds' end;
    insert into public.scheduled_agent_calls (
      interview_id, agent_id, application_id, client_id, candidate_id, job_id,
      sub_stage_id, status, run_at
    ) values (
      v_iv, r.agent_id, r.application_id, r.client_id, r.candidate_id, r.job_id,
      r.sub_stage_id, 'pending', v_run
    ) returning id into v_call;
  end if;

  return query select v_iv, v_call, v_start, v_end, v_lane, null::text;
end $$;

revoke all on function public.confirm_interview_booking(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.confirm_interview_booking(uuid, uuid, text, boolean)
  to service_role;
