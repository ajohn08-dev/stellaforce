-- claim_agent_call_for_interview — the targeted twin of claim_due_agent_calls.
--
-- The cron claims whatever is due; this claims the one call belonging to a named
-- interview, so a candidate pressing "Start now" is dialled from inside their own
-- request instead of waiting up to a minute for the next tick.
--
-- Deliberately the same shape as the batch claim rather than a plain UPDATE from
-- application code: the row must be locked, the attempt counted, the lease taken
-- and the interview/application re-checked in ONE statement, or the tick and the
-- inline path can both claim the same row and dial a candidate twice. It ignores
-- `run_at` — a start-now call is due by definition — but keeps every other
-- guard, including the lease, which is what makes it safe to run concurrently
-- with the cron.
create or replace function public.claim_agent_call_for_interview(
  p_interview_id  uuid,
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
  with target as (
    select c.id
      from public.scheduled_agent_calls c
      join public.interviews i   on i.id = c.interview_id
      join public.applications a on a.application_id = c.application_id
     where c.interview_id = p_interview_id
       and c.status = 'pending'
       and (c.locked_until is null or c.locked_until < now())
       and i.status = 'scheduled'
       and a.status = 'active'
     limit 1
       for update of c skip locked
  )
  update public.scheduled_agent_calls c
     set status = 'claimed',
         attempts = c.attempts + 1,
         last_attempt_at = now(),
         locked_until = now() + make_interval(secs => p_lease_seconds)
    from target, public.interviews i
   where c.id = target.id and i.id = c.interview_id
  returning c.id, c.interview_id, c.attempts, c.campaign_id,
            c.application_id, c.candidate_id, c.client_id, c.job_id,
            c.sub_stage_id, c.agent_id, i.scheduled_at;
$$;

-- Service-role only, like every other function in this family: it bypasses RLS
-- by construction and it leads directly to a phone call.
revoke all on function public.claim_agent_call_for_interview(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_agent_call_for_interview(uuid, integer) to service_role;
