-- Support the two-phase ElevenLabs post-call webhook delivery: the transcript
-- payload (post_call_transcription) arrives first and creates/updates the
-- row before any audio file exists; the audio payload arrives later and
-- updates that same row (matched by elevenlabs_conversation_id) once the
-- recording has been fetched and uploaded to the call-recordings bucket.

alter table public.call_recordings
  alter column storage_path drop not null,
  alter column filename drop not null;

alter table public.call_recordings
  add column audio_status text not null default 'pending'
    check (audio_status in ('pending', 'uploaded', 'failed'));
