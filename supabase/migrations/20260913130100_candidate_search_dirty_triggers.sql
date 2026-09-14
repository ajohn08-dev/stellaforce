-- 20260913130100 — mark candidates for search-enrichment reconciliation
--
-- Four triggers whose entire job is to stamp one timestamp. They query nothing,
-- call nothing, and decide nothing: the readiness rules live in application
-- code, where they can be read, tested headless, and changed without a
-- migration. **No external or LLM call may ever appear here** — a trigger runs
-- inside the writer's transaction, so anything slow or networked would hold a
-- résumé upload open behind it.
--
-- These are the backstop, not the main path. Every code path that writes
-- search-relevant data reconciles in-process, synchronously, so a candidate is
-- enriched by the time the recruiter sees them. The flag catches what those
-- paths miss: a psql fix, a future edit form, a backfill, a partial failure.
--
-- ⚠️ **The loop-breaker.** The reconciler's own writes land on
-- `candidates` — the seven classification columns. The UPDATE trigger below
-- therefore lists *input* columns only, and must never be widened to "any
-- column": a trigger that fired on the classification columns would re-dirty
-- the row it had just cleaned, forever, at whatever rate the sweep runs.

create or replace function public.mark_candidate_search_dirty()
returns trigger
language plpgsql
-- SECURITY DEFINER so the flag is recorded whoever wrote the row. The RLS on
-- `candidate_search_state` is Stellaforce-only; without this, a write from any
-- other session would silently drop the flag, and silently dropping the flag is
-- exactly the backlog this feature exists to prevent.
security definer
set search_path = ''
as $$
begin
  insert into public.candidate_search_state (candidate_id, search_dirty_at)
  values (coalesce(new.candidate_id, old.candidate_id), now())
  on conflict (candidate_id) do update set search_dirty_at = now();
  return null;
end;
$$;

comment on function public.mark_candidate_search_dirty() is
  'Stamps candidate_search_state.search_dirty_at. Does nothing else, on purpose.';

-- Reachable as an RPC and granted to PUBLIC by default like every function in
-- this schema; it is a trigger function and has no business being callable.
revoke execute on function public.mark_candidate_search_dirty() from public;
revoke execute on function public.mark_candidate_search_dirty() from anon;
revoke execute on function public.mark_candidate_search_dirty() from authenticated;

-- ── candidates ───────────────────────────────────────────────────────────────
--
-- INSERT and UPDATE are separate triggers because a WHEN clause may not
-- reference OLD on an insert.

create trigger trg_candidates_search_dirty_ins
  after insert on candidates
  for each row execute function public.mark_candidate_search_dirty();

create trigger trg_candidates_search_dirty_upd
  after update on candidates
  for each row
  when (
    old.current_title    is distinct from new.current_title
    or old.current_company is distinct from new.current_company
    or old.location_city   is distinct from new.location_city
    or old.location_state  is distinct from new.location_state
    or old.location_country is distinct from new.location_country
    or old.years_experience is distinct from new.years_experience
    or old.first_name      is distinct from new.first_name
    or old.last_name       is distinct from new.last_name
  )
  execute function public.mark_candidate_search_dirty();

-- ── child tables ─────────────────────────────────────────────────────────────
--
-- Row-level, and that is fine: N rows changing one candidate collapse into N
-- cheap updates of the *same* single state row, so one résumé ingestion —
-- which deletes and reinserts every work experience and upserts every skill —
-- owes exactly one unit of work afterwards.
--
-- DELETE matters as much as INSERT here: removing a candidate's last skill
-- changes what they are missing.

create trigger trg_work_experiences_search_dirty
  after insert or update or delete on candidate_work_experiences
  for each row execute function public.mark_candidate_search_dirty();

create trigger trg_candidate_skills_search_dirty
  after insert or delete on candidate_skills
  for each row execute function public.mark_candidate_search_dirty();

-- Parse state and which résumé is current are both readiness inputs.
create trigger trg_resumes_search_dirty
  after update on resumes
  for each row
  when (
    old.parse_status is distinct from new.parse_status
    or old.is_current is distinct from new.is_current
  )
  execute function public.mark_candidate_search_dirty();
