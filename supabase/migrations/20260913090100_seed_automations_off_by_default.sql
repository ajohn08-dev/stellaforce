-- Automations are off until someone turns them on.
--
-- The table shipped empty, which resolved to "every account runs" and preserved
-- the behaviour that existed before the switch. This flips the default the
-- other way: one global row at `off`, which every account inherits until it
-- decides for itself.
--
-- It is a DEFAULT, not a ceiling. An account that stores `active` beats this
-- row -- that asymmetry is the whole reason accounts resolve narrowest-wins
-- rather than as a fail-closed union, and it is what lets one account be turned
-- on for a pilot while everything else stays quiet.
--
-- Seeded as a row rather than by changing the resolver's fallback, so it is
-- visible in Platform settings and can be undone by clicking "On" instead of by
-- shipping another migration.
insert into public.automation_scope_settings (state, category, tenant_client_id)
values ('off', null, null)
on conflict do nothing;
