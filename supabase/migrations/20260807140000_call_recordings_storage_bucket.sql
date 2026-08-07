-- Private Storage bucket for call recordings: AI screening-agent calls and
-- human interview recordings. Two path shapes:
--   applications/{application_id}/{interviewer_type}/{timestamp}-{filename}.ext
--     - real recordings tied to a job+candidate pairing (interviewer_type:
--       'ai' | 'human' | 'external', matching the existing interviewer_type enum)
--   test/{timestamp}-{filename}.ext
--     - agent test-run calls (dummy candidate identity, see screening-agent
--       test-run dialog) that aren't tied to any real application
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'call-recordings',
  'call-recordings',
  false,
  104857600, -- 100 MB
  array[
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',
    'audio/x-m4a',
    'audio/ogg'
  ]
)
on conflict (id) do nothing;
