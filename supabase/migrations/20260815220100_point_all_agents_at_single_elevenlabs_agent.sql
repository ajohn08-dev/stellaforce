-- All six screening agents run on ONE ElevenLabs agent.
--
-- The workspace contains a single conversational agent ("Screening Agent"); what
-- makes an Engineering screen differ from a Who Interview is entirely the prompt
-- and dynamic variables we send at session start, from
-- src/lib/interview-agent-config.ts. The `agents` table therefore models the
-- *interview*, while `external_agent_id` is the shared voice runtime they all
-- borrow.
--
-- Consequence worth stating plainly: with a shared external id, prompt overrides
-- stop being optional. Until they are enabled on the ElevenLabs agent AND opted
-- into per fixture entry, every one of these six will conduct the same
-- interview, because the agent's own prompt is what actually runs.

update public.agents
set external_agent_id = 'agent_8301ky17agdveats253z9hw5f106',
    updated_at = now()
where external_agent_id is distinct from 'agent_8301ky17agdveats253z9hw5f106';
