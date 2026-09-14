-- Nothing writes `reason` any more.
--
-- It was a free-text "why" prompted on every flip. On a switch people toggle
-- routinely that is friction which gets filled with "." and tells the next
-- reader nothing, so the prompt is gone -- and a column no writer populates is
-- worse than no column: every reader has to handle a value that is always null.
-- `audit_log` still records who changed what, when, and from which state, which
-- is the part that was ever actually consulted.
alter table public.automation_scope_settings drop column reason;
