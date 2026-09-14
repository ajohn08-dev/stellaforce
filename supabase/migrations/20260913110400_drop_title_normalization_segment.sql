-- 20260913110400 — remove the sales-segment axis from title normalization
--
-- ⚠️ Housekeeping, and a no-op on a fresh database. An earlier revision of this
-- same branch carried a fourth classification axis — `sales_segment`, a
-- `candidates.segment` column, a `title_aliases.implied_segment` column, and a
-- constraint trigger keeping segment sales-only. It was cut from V1 scope
-- before release: "Enterprise" and "Strategic" stay in the raw title, where the
-- existing free-text "Title contains" filter already finds them, and promoting
-- them to a structured field needs a definition of what the word claims that V1
-- does not have.
--
-- The three creating migrations (20260913110000/110100/110200) were rewritten to
-- the final, segment-free shape, so replaying this repo from scratch never
-- creates any of it. This file exists only to bring an environment that already
-- ran the earlier revision into line — every statement is `if exists`, so on a
-- fresh database it drops nothing and succeeds.

-- The candidate column and its CHECK (dropped with the column).
alter table public.candidates
  drop column if exists segment;

drop index if exists public.idx_candidates_segment;

-- The alias column, and the trigger that kept it sales-only.
drop trigger if exists trg_title_aliases_segment_requires_sales on public.title_aliases;
drop function if exists public.title_aliases_segment_requires_sales();

alter table public.title_aliases
  drop column if exists implied_segment;

-- Last, once nothing references it.
drop type if exists public.sales_segment;
