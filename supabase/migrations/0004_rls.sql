-- ─────────────────────────────────────────────────────────────────────────────
-- 0004 — Row-Level Security (minimal for demo)
--
-- Policy model: authenticated users (recruiters) can read/write all rows.
-- Anonymous (unauthenticated) users get NOTHING — candidate PII is never public.
-- The service-role key (server-only) bypasses RLS for privileged operations.
--
-- This is intentionally coarse for the demo. Tighten later (e.g. per-recruiter
-- ownership, client-scoped visibility) without changing app code.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  tbl text;
  tables text[] := array[
    'candidates', 'skills', 'clients', 'job_orders', 'applications',
    'placements', 'interactions', 'candidate_client_fit'
  ];
begin
  foreach tbl in array tables loop
    execute format('alter table %I enable row level security;', tbl);

    -- One permissive policy per table for authenticated recruiters (all commands).
    execute format($f$
      create policy "recruiters_all_%1$s" on %1$I
        for all
        to authenticated
        using (true)
        with check (true);
    $f$, tbl);
  end loop;
end $$;
