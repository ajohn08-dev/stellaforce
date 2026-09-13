-- 20260913100100 — candidate visibility: lock the predicates off the public API
--
-- Functions are granted EXECUTE to PUBLIC by default, and every function in
-- `public` is reachable as `POST /rest/v1/rpc/<name>`. That made the five
-- predicates from 20260913100000 callable by the `anon` role — so a signed-out
-- caller could ask `profile_client_id(<uuid>)` which client a profile belongs to,
-- or use `current_profile_can_read_candidate(<uuid>)` as a boolean oracle to
-- probe which candidate ids exist.
--
-- A policy expression is evaluated with the privileges of the *querying* role, so
-- `authenticated` must keep EXECUTE or every policy in that migration fails
-- closed. `anon` needs none of them: it has no access to any candidate table.

revoke execute on function public.profile_client_id(uuid) from public, anon;
revoke execute on function public.current_profile_can_read_candidate_row(uuid, uuid) from public, anon;
revoke execute on function public.current_profile_can_write_candidate_row(uuid) from public, anon;
revoke execute on function public.current_profile_can_read_candidate(uuid) from public, anon;
revoke execute on function public.current_profile_can_write_candidate(uuid) from public, anon;

grant execute on function public.profile_client_id(uuid) to authenticated, service_role;
grant execute on function public.current_profile_can_read_candidate_row(uuid, uuid) to authenticated, service_role;
grant execute on function public.current_profile_can_write_candidate_row(uuid) to authenticated, service_role;
grant execute on function public.current_profile_can_read_candidate(uuid) to authenticated, service_role;
grant execute on function public.current_profile_can_write_candidate(uuid) to authenticated, service_role;

-- Note: `current_profile_side()`, `current_profile_client_id()` and
-- `current_profile_is_account_admin()` carry the same anon exposure and predate
-- this change. They leak less (they take no argument, so they only describe the
-- caller, and for `anon` that is null) and are left alone here rather than
-- changed as a side effect of an unrelated migration.
