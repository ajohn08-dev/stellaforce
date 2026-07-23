-- Widen resume visibility: any Stellaforce-side user (recruiter/manager/
-- admin) can view any resume, not just the one who uploaded it. Client-side
-- profiles are excluded — resumes stay internal. Upload/update/delete
-- remain scoped to the uploading owner's folder (unchanged).
drop policy "resumes: owner can read" on storage.objects;

create policy "resumes: stellaforce can read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.side = 'stellaforce'
    )
  );
