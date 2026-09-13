-- 20260913100000 — candidate visibility RLS
--
-- Makes the candidate-visibility rule explicit in the database instead of
-- leaving it to whoever writes the next query.
--
--   Stellaforce-side profile  → the whole global candidate brain, every client.
--   Client-side profile       → READ  candidates their own client entered,
--                                     plus candidates submitted to their jobs.
--                               WRITE candidates their own client entered, only.
--
-- Until now every candidate table carried `recruiters_all_*` as
-- `FOR ALL TO authenticated USING (true) WITH CHECK (true)` — RLS was *enabled*
-- and the predicate did not restrict, so a client-side hiring manager could read
-- and edit every candidate in the system. Those policies are dropped here; a
-- permissive policy left alongside these would be OR'd with them and silently
-- restore the old behaviour.
--
-- Ownership is `candidates.added_by → profiles.client_id`. A null `added_by`, or
-- an `added_by` belonging to a Stellaforce profile, means no client owns the row
-- — it is the Stellaforce collection, and no client-side user reads it unless it
-- has been submitted to one of their jobs. That is fail-closed by construction.
--
-- Read and write are deliberately different predicates. A client reviewing a
-- candidate Stellaforce submitted to their req must be able to see that
-- candidate; they must not be able to edit the master record in the global brain.

-- ---------------------------------------------------------------------------
-- 1. Predicates — one rule, expressed once.
-- ---------------------------------------------------------------------------

-- The client a profile belongs to. Null for Stellaforce-side profiles.
create or replace function public.profile_client_id(p_profile_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select client_id from public.profiles where id = p_profile_id;
$$;

comment on function public.profile_client_id(uuid) is
  'The client that owns a profile; null for Stellaforce-side profiles.';

-- The canonical read rule. Takes `added_by` as a VALUE rather than re-reading
-- `candidates`, so the policy on `candidates` itself cannot recurse into its own
-- predicate. Child tables reach it through the wrapper below.
create or replace function public.current_profile_can_read_candidate_row(
  p_candidate_id uuid,
  p_added_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    -- Stellaforce sees everything, including candidates entered by clients.
    when public.current_profile_side() = 'stellaforce' then true
    -- No profile, or a profile with no client: nothing.
    when public.current_profile_client_id() is null then false
    else
      -- entered by someone at my client
      public.profile_client_id(p_added_by) = public.current_profile_client_id()
      -- or submitted to one of my client's jobs
      or exists (
        select 1 from public.applications a
        where a.candidate_id = p_candidate_id
          and a.client_id = public.current_profile_client_id()
      )
      -- or an explicit candidate↔client relationship
      or exists (
        select 1 from public.candidate_client_fit f
        where f.candidate_id = p_candidate_id
          and f.client_id = public.current_profile_client_id()
      )
  end;
$$;

comment on function public.current_profile_can_read_candidate_row(uuid, uuid) is
  'Read rule: Stellaforce sees all; a client sees candidates it entered plus candidates submitted to its jobs.';

-- The canonical write rule: ownership only. Being able to *see* a candidate
-- Stellaforce submitted to your req does not make the master record yours.
create or replace function public.current_profile_can_write_candidate_row(
  p_added_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.current_profile_side() = 'stellaforce' then true
    when public.current_profile_client_id() is null then false
    else public.profile_client_id(p_added_by) = public.current_profile_client_id()
  end;
$$;

comment on function public.current_profile_can_write_candidate_row(uuid) is
  'Write rule: Stellaforce writes all; a client writes only candidates its own users entered.';

-- Wrappers for the child tables, which carry `candidate_id` and not `added_by`.
-- SECURITY DEFINER, so the lookup is not itself filtered by the candidates policy.
create or replace function public.current_profile_can_read_candidate(p_candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_profile_can_read_candidate_row(
    p_candidate_id,
    (select c.added_by from public.candidates c where c.candidate_id = p_candidate_id)
  );
$$;

create or replace function public.current_profile_can_write_candidate(p_candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_profile_can_write_candidate_row(
    (select c.added_by from public.candidates c where c.candidate_id = p_candidate_id)
  );
$$;

-- Supports the `applications` EXISTS in the read rule. The existing indexes lead
-- with candidate_id or client_id alone; the predicate uses both together.
create index if not exists idx_applications_client_candidate
  on public.applications (client_id, candidate_id);

-- ---------------------------------------------------------------------------
-- 2. candidates
-- ---------------------------------------------------------------------------

drop policy if exists recruiters_all_candidates on public.candidates;

create policy candidates_select on public.candidates
  for select to authenticated
  using (public.current_profile_can_read_candidate_row(candidate_id, added_by));

-- A client-side user may add candidates, attributed to their own client. The
-- check is against the NEW row's added_by, so ownership cannot be set to another
-- client's profile on the way in.
create policy candidates_insert on public.candidates
  for insert to authenticated
  with check (public.current_profile_can_write_candidate_row(added_by));

-- USING tests the existing row, WITH CHECK the new one — so ownership can be
-- neither seized nor handed to another client by an UPDATE.
create policy candidates_update on public.candidates
  for update to authenticated
  using (public.current_profile_can_write_candidate_row(added_by))
  with check (public.current_profile_can_write_candidate_row(added_by));

create policy candidates_delete on public.candidates
  for delete to authenticated
  using (public.current_profile_can_write_candidate_row(added_by));

-- ---------------------------------------------------------------------------
-- 3. Candidate child tables — visibility follows the candidate, always.
-- ---------------------------------------------------------------------------
-- Leaving these permissive is what made the rule bypassable: PostgREST will
-- happily serve candidate_skills or candidate_work_experiences directly.

-- `resumes` is the one child table whose old policy was not named recruiters_all_*.
drop policy if exists "resumes: authenticated read/write" on public.resumes;

do $$
declare
  t text;
begin
  foreach t in array array[
    'candidate_work_experiences',
    'candidate_skills',
    'candidate_tools',
    'candidate_education',
    'candidate_certifications',
    'candidate_links',
    'resumes',
    'interactions'
  ]
  loop
    execute format('drop policy if exists recruiters_all_%I on public.%I', t, t);

    execute format(
      'create policy %I on public.%I for select to authenticated
         using (public.current_profile_can_read_candidate(candidate_id))',
      t || '_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (public.current_profile_can_write_candidate(candidate_id))',
      t || '_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (public.current_profile_can_write_candidate(candidate_id))
         with check (public.current_profile_can_write_candidate(candidate_id))',
      t || '_update', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (public.current_profile_can_write_candidate(candidate_id))',
      t || '_delete', t
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. Client-keyed tables — these carry client_id directly.
-- ---------------------------------------------------------------------------
-- A client sees its own rows and no one else's; Stellaforce sees every client.

drop policy if exists recruiters_all_applications on public.applications;
drop policy if exists recruiters_all_placements on public.placements;
drop policy if exists recruiters_all_candidate_client_fit on public.candidate_client_fit;

do $$
declare
  t text;
begin
  foreach t in array array['applications', 'placements', 'candidate_client_fit']
  loop
    -- FOR ALL already covers SELECT via USING and INSERT via WITH CHECK; a
    -- second FOR SELECT policy would only be OR'd with an identical predicate.
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.current_profile_side() = ''stellaforce''
                or client_id = public.current_profile_client_id())
         with check (public.current_profile_side() = ''stellaforce''
                or client_id = public.current_profile_client_id())',
      t || '_tenant_scoped', t
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Deliberately unchanged
-- ---------------------------------------------------------------------------
-- `skills` and `tools` stay permissive. They are global vocabularies of names —
-- 556 and 273 rows shared by every client — and hold no candidate data. Scoping
-- them per client would fragment the lookup that `findOrCreateLookupRows`
-- depends on and reveal nothing if left open.
--
-- The service-role key bypasses RLS entirely, so resume ingestion, the n8n
-- callbacks, seeding and backfills are unaffected by any of the above.
