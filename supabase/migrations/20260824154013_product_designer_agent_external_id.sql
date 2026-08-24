-- Point the Product Designer screening agent at the one ElevenLabs agent this
-- workspace has. There is deliberately no second external agent: the voice,
-- the greeting and the override permission are properties of that one agent,
-- and what differs per screen is the prompt, which
-- `src/lib/interview-agent-config.ts` builds per `agents.id` and sends as a
-- conversation override. Every other seeded agent already shares this id.
update public.agents
set external_agent_id = 'agent_8301ky17agdveats253z9hw5f106'
where id = '5c63f255-b827-45f1-bdbc-74a5a03ded04'
  and external_agent_id is null;
