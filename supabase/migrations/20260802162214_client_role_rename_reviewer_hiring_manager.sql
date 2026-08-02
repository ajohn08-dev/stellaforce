-- Remap client_role enum labels:
--   'reviewer' -> 'hiring_manager'
--   'member'   -> 'reviewer'
-- 'admin' and 'recruiter' are unchanged (recruiter already exists).
-- Order matters: rename 'reviewer' away FIRST so 'member' can reuse the name.
alter type client_role rename value 'reviewer' to 'hiring_manager';
alter type client_role rename value 'member' to 'reviewer';
