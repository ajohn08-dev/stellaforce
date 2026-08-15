-- Candidate-side video for browser interview-room calls.
--
-- The room is an *audio* conversation with the ElevenLabs agent; the candidate's
-- camera never reaches ElevenLabs. Video is therefore captured in the browser
-- (MediaRecorder) and uploaded by the app, which is why it needs its own owned-
-- media columns rather than reusing `video_url`.
--
-- `video_url` keeps its documented meaning: a plain external link for stages run
-- on a third-party platform (a Zoom recording), NOT media we hold.

alter table public.call_recordings
  -- Unique for the same reason storage_path is: it doubles as the idempotency
  -- key for a re-uploaded recording.
  add column if not exists video_storage_path text unique,
  add column if not exists video_filename text,
  add column if not exists video_mime_type text,
  add column if not exists video_file_size bigint,
  add column if not exists video_duration_seconds integer,
  -- Mirrors audio_status. 'pending' = the room is recording or uploading;
  -- 'uploaded' = playable; 'failed' = the upload did not complete (a closed tab
  -- mid-interview is the expected cause, since the buffer lives in the page).
  add column if not exists video_status text
    check (video_status in ('pending', 'uploaded', 'failed'));

comment on column public.call_recordings.video_status is
  'pending | uploaded | failed — lifecycle of the browser-recorded candidate video.';
comment on column public.call_recordings.video_url is
  'Plain external link for third-party-hosted video (e.g. a Zoom recording). NOT the browser-recorded candidate video — see video_storage_path.';

-- The bytes themselves live in a dedicated `video-recordings` bucket, created
-- in the next migration; `video_storage_path` is a path within it.
