-- Dedicated bucket for candidate-side interview video.
--
-- Kept separate from `call-recordings` rather than sharing it, for three
-- reasons that all come down to video being a different kind of asset:
--   * size — video is 10–100x audio, and a shared bucket forces one
--     file_size_limit on both. This bucket is 500 MB; call-recordings stays 100 MB.
--   * retention — a candidate's likeness may need purging on a different (and
--     usually shorter) clock than their voice and transcript.
--   * access — biometric-adjacent media deserves its own policy surface, so it
--     can be tightened or revoked without touching audio access.
--
-- The link back lives on `call_recordings.video_storage_path`, so one row still
-- describes the whole interview; only the bytes live elsewhere.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'video-recordings',
  'video-recordings',
  false,
  524288000, -- 500 MB
  array['video/webm', 'video/mp4', 'video/x-matroska']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

comment on column public.call_recordings.video_storage_path is
  'Object path in the **video-recordings** bucket (not call-recordings) for the candidate-side video captured in the browser. Null for phone calls, which have no video.';

-- RLS mirrors call-recordings exactly, so the same path convention keeps
-- working: Stellaforce-side gets everything; client-side gets read-only, scoped
-- to applications/{application_id}/... for their own client, and no access at
-- all to test/... (dummy-identity agent test runs).

create policy "video-recordings: stellaforce can read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'video-recordings'
    and public.current_profile_side() = 'stellaforce'
  );

create policy "video-recordings: stellaforce can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'video-recordings'
    and public.current_profile_side() = 'stellaforce'
  );

create policy "video-recordings: stellaforce can update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'video-recordings'
    and public.current_profile_side() = 'stellaforce'
  )
  with check (
    bucket_id = 'video-recordings'
    and public.current_profile_side() = 'stellaforce'
  );

create policy "video-recordings: stellaforce can delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'video-recordings'
    and public.current_profile_side() = 'stellaforce'
  );

create policy "video-recordings: client can read own applications"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'video-recordings'
    and (storage.foldername(name))[1] = 'applications'
    and exists (
      select 1 from public.applications a
      where a.application_id = ((storage.foldername(name))[2])::uuid
        and a.client_id = public.current_profile_client_id()
    )
  );
