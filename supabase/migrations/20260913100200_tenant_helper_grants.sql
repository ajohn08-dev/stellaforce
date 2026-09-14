-- 20260913100200 — take the tenant helpers off the public API too
--
-- The counterpart to 20260913100100. `current_profile_side()`,
-- `current_profile_client_id()` and `current_profile_is_account_admin()` predate
-- the candidate-visibility work and carry the same exposure: every function in
-- `public` is reachable as `POST /rest/v1/rpc/<name>`, and they were granted
-- EXECUTE to PUBLIC by default.
--
-- They leak less than the candidate predicates did — they take no argument, so
-- they only ever describe the caller, and for `anon` every one of them answers
-- null/false. But a SECURITY DEFINER function on the public API with no reason
-- to be there is a standing invitation, and nothing in the app calls them: they
-- are referenced only from RLS policy expressions, which are evaluated with the
-- privileges of the querying role. So `authenticated` keeps EXECUTE and
-- everybody else loses it.
--
-- `handle_new_user()` is deliberately NOT touched. It is a trigger function on
-- auth.users, and the cost of being wrong about whether the trigger path needs
-- the grant is that account creation breaks. Trigger execution does not check
-- EXECUTE, so revoking would almost certainly be safe — "almost certainly" is
-- not the standard for the signup path, and it writes nothing a caller controls.

revoke execute on function public.current_profile_side() from public, anon;
revoke execute on function public.current_profile_client_id() from public, anon;
revoke execute on function public.current_profile_is_account_admin() from public, anon;

grant execute on function public.current_profile_side() to authenticated, service_role;
grant execute on function public.current_profile_client_id() to authenticated, service_role;
grant execute on function public.current_profile_is_account_admin() to authenticated, service_role;
