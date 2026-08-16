-- How far ahead of the conversation audio the candidate video starts.
--
-- The browser starts recording when "Start Interview" is pressed, but ElevenLabs
-- only starts its own recording once the conversation actually opens — after
-- WebRTC negotiation and agent spin-up, typically 1-3 seconds later. The two
-- files therefore have different t=0.
--
-- Trying to align them by delaying the recorder proved fragile (the start hook
-- has to fire before the first frame, and when it doesn't there is no recording
-- at all). Recording from the click is reliable; storing the measured gap and
-- shifting the video at playback is exact. The player seeks video to
-- `audio.currentTime + video_offset_seconds`.

alter table public.call_recordings
  add column if not exists video_offset_seconds numeric(6, 3) not null default 0;

comment on column public.call_recordings.video_offset_seconds is
  'Seconds the candidate video leads the conversation audio (recording starts on click, ElevenLabs starts on connect). Playback seeks video to audio.currentTime + this. 0 when unknown.';
