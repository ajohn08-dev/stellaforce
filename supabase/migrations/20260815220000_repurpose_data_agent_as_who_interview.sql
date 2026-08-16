-- Repurposes the seeded "Data & Analytics Screen" agent as the Who Interview.
--
-- The interview content itself lives in src/lib/interview-agent-config.ts, but
-- the Agents page, the Conversations list, and the interview-room briefing all
-- render `agents.name` / `agents.description` from here — so renaming the row is
-- what actually makes the change visible.
--
-- `avg_handle_time_minutes` is not cosmetic: it drives the "Around N minutes"
-- line the candidate reads on the briefing screen before joining. Ten
-- evidence-gathering questions with follow-ups is a 30-45 minute conversation,
-- so leaving it at 6 would have told candidates something untrue.

update public.agents
set name = 'Who Interview',
    description = 'Structured Who-style interview covering career history, '
                  'signature accomplishments, problem-solving, adaptability, '
                  'and first-90-days plans. Evidence-gathering rather than a '
                  'quick screen.',
    avg_handle_time_minutes = 35,
    updated_at = now()
where id = '8490ea4c-ad8f-4f25-a0f7-74ff7e50b737';
