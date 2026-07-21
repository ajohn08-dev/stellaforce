-- ─────────────────────────────────────────────────────────────────────────────
-- V3.2 — New enum types and url domain
-- See CLAUDE.md "Frozen schema (V3.2)" for the full reference.
-- ─────────────────────────────────────────────────────────────────────────────

create type pipeline_stage as enum ('source', 'screen', 'interview', 'offer', 'close');
create type competency_type as enum ('technical', 'behavioral', 'hybrid', 'leadership');
create type fit_proficiency_level as enum ('aware', 'proficient', 'expert');
create type confidence_level as enum ('low', 'medium', 'high');
create type application_status as enum ('active', 'hired', 'rejected', 'withdrawn', 'on_hold');
create type eval_status as enum ('pending', 'completed');
create type stage_format as enum ('phone', 'video', 'onsite', 'async');
create type rating_scale as enum ('star', 'ten-point', 'hundred-point');
create type employment_type as enum ('full-time', 'part-time', 'contract', 'freelance', 'internship');
create type workplace_type as enum ('on-site', 'hybrid', 'remote');

-- Reusable URL domain (applied to newly-added url columns only; existing text
-- columns like candidates.linkedin_url are left as-is to avoid a data rewrite).
create domain url as text check (value ~* '^https?://.+');
