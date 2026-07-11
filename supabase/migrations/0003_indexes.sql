-- ─────────────────────────────────────────────────────────────────────────────
-- 0003 — Indexes
-- Foreign-key indexes for join/filter performance + ivfflat for vector search.
-- ─────────────────────────────────────────────────────────────────────────────

-- Foreign-key column indexes
create index idx_skills_candidate_id            on skills (candidate_id);
create index idx_job_orders_client_id           on job_orders (client_id);
create index idx_applications_candidate_id       on applications (candidate_id);
create index idx_applications_job_id             on applications (job_id);
create index idx_applications_client_id          on applications (client_id);
create index idx_placements_candidate_id         on placements (candidate_id);
create index idx_placements_client_id            on placements (client_id);
create index idx_placements_job_id               on placements (job_id);
create index idx_interactions_candidate_id       on interactions (candidate_id);
create index idx_candidate_client_fit_candidate  on candidate_client_fit (candidate_id);
create index idx_candidate_client_fit_client     on candidate_client_fit (client_id);

-- Common structured-filter columns
create index idx_candidates_tier    on candidates (candidate_tier);
create index idx_applications_stage on applications (stage);
create index idx_job_orders_status  on job_orders (status);

-- Vector similarity index (cosine). ivfflat requires a fixed dimension (1536).
-- `lists` is a tuning knob; 100 is a reasonable default for small/medium tables.
-- Build after seeding for best centroid quality, but creating on an empty table
-- is safe and will be used as rows are added.
create index idx_candidates_embedding
  on candidates
  using ivfflat (embedding_vector vector_cosine_ops)
  with (lists = 100);
