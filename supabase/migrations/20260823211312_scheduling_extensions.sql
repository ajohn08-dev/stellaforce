-- btree_gist supplies the `uuid with =` / `smallint with =` operator classes that
-- an EXCLUDE ... USING GIST needs alongside `tstzrange with &&`. Without it the
-- agent-lane overlap constraints in the interview tables cannot be created.
--
-- Verified available on this instance (v1.7) and not previously installed.
-- Installed into `extensions` alongside pgcrypto rather than `public`, so the
-- security linter's "extension in public" advisory stays clean.
create extension if not exists btree_gist with schema extensions;
