-- The Sales Executive role is in Charleston, South Carolina, but the global
-- scheduling default is US Pacific — so the first booking link for this job
-- offered 9-5 Pacific slots, i.e. noon to 8pm for the team that has to take the
-- call. Overridden at job scope, which is what the settings cascade is for.
--
-- `us_eastern` is a slug of the UI label, not an IANA string: `slug()` in
-- src/lib/scheduling-policy.ts lowercases and strips punctuation, and
-- scheduling-runtime.ts maps the slug to the real zone.
update public.workflow_settings
set config = config || '{"operating_timezone": "us_eastern"}'::jsonb
where scope = 'job'
  and scope_id = '4d7b2a19-8c50-4e63-9f1a-7e05c3b81d92'
  and category = 'scheduling';
