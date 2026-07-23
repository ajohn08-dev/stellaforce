-- storage_path convention is now {candidate_id}/{timestamp}-{filename}
-- (see resumes.storage_path), not {auth.uid()}/... — candidates have no
-- login, so "owner" was never a meaningful concept for these objects.
-- Replace the uploader-folder-scoped write policies with the same
-- Stellaforce-wide check already used for reads.
drop policy "resumes: owner can upload" on storage.objects;
drop policy "resumes: owner can update" on storage.objects;
drop policy "resumes: owner can delete" on storage.objects;

create policy "resumes: stellaforce can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'resumes'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.side = 'stellaforce'
    )
  );

create policy "resumes: stellaforce can update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'resumes'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.side = 'stellaforce'
    )
  )
  with check (
    bucket_id = 'resumes'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.side = 'stellaforce'
    )
  );

create policy "resumes: stellaforce can delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'resumes'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.side = 'stellaforce'
    )
  );
