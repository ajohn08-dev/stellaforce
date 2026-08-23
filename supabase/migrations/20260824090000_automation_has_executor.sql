-- Which automations actually do something.
--
-- All 14 definitions have a published version and an active global binding, and
-- exactly one of them has code behind it. Until now the ⚡ dialog read "Active ·
-- Global library" for all fourteen — which is the lie this column ends. A rule
-- with no executor is not running, so it must not say it is, and its controls
-- must not offer to change something that would have no effect.
--
-- Default false, deliberately: a definition seeded tomorrow has no executor
-- until someone writes one. The migration that ships an executor is the same one
-- that flips this and turns its binding on, so "on" can only ever mean "runs".
alter table public.automation_definitions
  add column has_executor boolean not null default false;

comment on column public.automation_definitions.has_executor is
  'True when code exists that acts on this rule. False = configuration only: the '
  'resolver reports it locked, the UI disables its controls, and its global '
  'binding is off. Flip it in the same migration that ships the executor.';

-- The one that runs. Stage entry -> gate -> scheduling request + token -> n8n
-- emails /book/<token> -> booking -> queued call -> cron dispatch.
update public.automation_definitions
   set has_executor = true
 where key = 'send_booking_link' and client_id is null;

-- Everything else is off at global scope. Not a product decision about whether
-- these rules are wanted — they are — but a statement of fact: nothing consumes
-- their triggers yet.
--
-- Note `interview_scheduled` and `interview_completed` are here too. Their
-- events now genuinely fire (booking writes one, completeInterview the other),
-- but nothing acts on them, and a rule whose actions never run is not running.
update public.automation_bindings b
   set state = 'off'
  from public.automation_definitions d
 where b.automation_definition_id = d.id
   and b.scope = 'global'
   and d.client_id is null
   and d.has_executor = false;
