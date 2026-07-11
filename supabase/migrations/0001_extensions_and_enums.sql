-- ─────────────────────────────────────────────────────────────────────────────
-- 0001 — Extensions and enum types
-- Frozen schema for Stella Force. See CLAUDE.md for the source-of-truth reference.
-- ─────────────────────────────────────────────────────────────────────────────

-- pgvector for embedding similarity search (candidates.embedding_vector).
create extension if not exists vector;

-- gen_random_uuid() is provided by pgcrypto (available by default on Supabase,
-- but declared here for portability).
create extension if not exists pgcrypto;

-- ── Enum types ───────────────────────────────────────────────────────────────

create type candidate_tier as enum ('gold', 'silver', 'bronze');

create type data_provenance as enum ('ai_parsed', 'recruiter_confirmed', 'enriched');

create type skill_type as enum ('hard', 'soft');

-- Proficiency mapped to a 5-level ordinal scale (novice=1 .. expert=5).
create type proficiency_level as enum ('novice', 'beginner', 'intermediate', 'advanced', 'expert');

create type client_status as enum ('active', 'paused', 'churned');

create type job_status as enum ('open', 'on_hold', 'filled', 'closed');

create type application_stage as enum (
  'sourced', 'screened', 'submitted', 'interviewing', 'offer', 'placed', 'rejected'
);

create type placement_status as enum ('active', 'completed', 'fell_through');

create type interaction_type as enum ('call', 'email', 'interview', 'note');

create type nurture_status as enum ('active', 'dormant', 're_engaging');
