-- storage.objects RLS for the call-recordings bucket.
-- Stellaforce-side: full read/upload/update/delete on everything (both
-- applications/... and test/... prefixes).
-- Client-side: read-only, and only under applications/{application_id}/...
-- for applications belonging to their own client (current_profile_client_id()).
-- No client access at all to test/... (dummy-identity agent test-run calls).

create policy "call-recordings: stellaforce can read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'call-recordings'
    and public.current_profile_side() = 'stellaforce'
  );

create policy "call-recordings: stellaforce can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'call-recordings'
    and public.current_profile_side() = 'stellaforce'
  );

create policy "call-recordings: stellaforce can update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'call-recordings'
    and public.current_profile_side() = 'stellaforce'
  )
  with check (
    bucket_id = 'call-recordings'
    and public.current_profile_side() = 'stellaforce'
  );

create policy "call-recordings: stellaforce can delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'call-recordings'
    and public.current_profile_side() = 'stellaforce'
  );

create policy "call-recordings: client can read own applications"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'call-recordings'
    and (storage.foldername(name))[1] = 'applications'
    and exists (
      select 1 from public.applications a
      where a.application_id = ((storage.foldername(name))[2])::uuid
        and a.client_id = public.current_profile_client_id()
    )
  );
