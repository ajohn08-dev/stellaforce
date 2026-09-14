-- 20260913140000 — derived ISO-2 country code
--
-- Computed from the raw `location_country` by the search-enrichment reconciler.
--
-- A separate column rather than normalizing `location_country` in place: that
-- column is what the résumé parse produced, and this feature does not rewrite
-- raw candidate data. Today the same country arrives as both `IN` and `India`,
-- so an equality filter on the raw column answers "engineers in India" two
-- different ways depending on which spelling a résumé happened to use.
--
-- Country only. No state, region, metro or radius resolution — those need data
-- that does not exist here, and a wrong guess about where someone lives is
-- worse than an honest gap. "Greater Boston" and "within 25 miles" stay
-- unsupported, and now say so loudly in the results header.

alter table candidates
  add column country_code text
    check (country_code is null or country_code ~ '^[A-Z]{2}$');

create index idx_candidates_country_code on candidates (country_code);

comment on column candidates.country_code is
  'Derived ISO 3166-1 alpha-2, normalized from location_country by the enrichment reconciler. Raw location_country is never modified.';
