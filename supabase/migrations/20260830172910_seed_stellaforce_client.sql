-- Stellaforce as a hiring client.
--
-- The id is explicit because later migrations (the job, its settings snapshot)
-- reference it, and because `clients.client_id` defaults to gen_random_uuid() —
-- a generated one could not be named in the next migration file.
--
-- Note the table is deliberately thin. The rich company profile — culture, work
-- authorization, why-join — lives in `src/lib/mock-companies.ts` and shares no
-- key with this row; see the /companies section of CLAUDE.md.
insert into public.clients (client_id, client_name, status, industry, website_url, plan, notes)
values (
  'c1e0f4a2-6d3b-4f8e-9a17-2b5c8d0e7f31',
  'Stellaforce',
  'active',
  'AI & agentic recruiting technology',
  'https://stellaforce.ai',
  'premium',
  'Recruiting-tech company building agentic screening and interview software. Hiring go-to-market roles out of Charleston, SC.'
)
on conflict (client_id) do nothing;
