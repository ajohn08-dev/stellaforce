# Stellaforce V2 Candidate Search — Database Inspection

## 1. Executive Summary

- **Canonical candidate table:** `public.candidates` (PK `candidate_id uuid`, 42 rows). Confirmed — every candidate-domain child table has an enforced FK to it, and it is the only table holding identity + location + current role.
- **Candidate data model:** A normalized hub-and-spoke. `candidates` holds denormalized "current" fields (`current_title`, `current_company`, `headline`, `years_experience`, split location columns); history lives in `candidate_work_experiences`; skills and tools are **many-to-many join tables against global lookup tables** (`skills` 556 rows, `tools` 273 rows, both uniquely indexed on `lower(name)`). Nothing is a JSON blob except optional side-car fields (`source_metadata`, `parsed_data`, `scorecard`).
- **Candidate visibility / tenancy model:** **Global, not tenant-scoped.** `candidates` has no `client_id`. Client linkage exists only indirectly through `applications` (candidate × job × client) and `candidate_client_fit` (0 rows). 27 of 42 candidates have no application at all, so they belong to no client.
- **Existing search capability:** Effectively **none**. No `tsvector` columns, no GIN indexes, `pg_trgm`/`unaccent`/`citext` **not installed**, no search RPC, view, or Edge Function. The only search-shaped asset is `candidates.embedding_vector vector(1536)` with an ivfflat cosine index — populated for 28 of 42 rows, but per the project's own `CLAUDE.md` those values are a **deterministic placeholder**, not real semantic embeddings (they are 28 distinct values, so they *look* populated while carrying no semantic signal).
- **Most important data-quality limitation:** **There is no normalized/canonical title, no seniority field, and no role-family field anywhere in the schema.** `current_title` is free text with 34 distinct spellings across 42 candidates. "Find account executives" cannot be answered by equality or by a lookup table today — only by `ILIKE`, which has no index to support it.
- **Main unknowns (need confirmation):**
  1. Whether candidate search must be tenant-filtered at all, given `candidates` is global by design and the RLS policy is `USING (true)` for every authenticated user (see §6 — this is the one genuine risk found).
  2. Which of `current_title`/`current_company` is authoritative vs. derivable — they disagree with the candidate's own current work-experience row in 3–4 of 26 cases.
  3. Whether the 14 `source = 'qa_test_fixture'` candidates (33% of the table) should be excluded from every completeness statistic below; they skew several of them heavily.
  4. Whether a `companies`/`employers` entity is planned — company is free text in 128 distinct spellings today.

---

## 2. Relevant Tables

| Table | Purpose | Approx. rows | Primary key | Candidate-search relevance |
|---|---|---|---|---|
| `candidates` | **Canonical candidate record**: name, headline, current title/company, split location, years of experience, tier, provenance, embedding | 42 | `candidate_id` | **Primary.** Name, title, company, city/state/country, remote preference, YOE, source, timestamps |
| `candidate_work_experiences` | Employment history (company, title, location, dates, remote flag, employment type) | 153 | `id` | **Primary.** Past titles, past companies, per-role dates → derived seniority & role-specific YOE |
| `candidate_skills` | Candidate ↔ skill link with proficiency + years | 625 | `id` | **Primary.** Skill filter; `unique(candidate_id, skill_id)` |
| `skills` | Global skill lookup (`skill_type`: technical/functional/behavioral; `category` **unpopulated**) | 556 | `id` | **Primary.** Canonical skill vocabulary; unique on `lower(name)` |
| `candidate_tools` / `tools` | Same shape as skills, for tools/software | 390 / 273 | `id` | High — a second skill-like axis |
| `candidate_education` | Degrees, institutions, fields, dates | 48 | `id` | Medium — education filters |
| `candidate_certifications` | Certifications + issuer + dates | 23 | `id` | Low/medium |
| `candidate_links` | Arbitrary profile URLs (`unique(candidate_id, url)`) | 26 | `id` | Low — enrichment only |
| `resumes` | Resume binaries metadata + `parsed_data` jsonb + `parse_status`; one current per candidate | 30 | `id` | Medium — raw evidence; `parsed_data` is the only place unstructured resume text may live |
| `ingestion_jobs` | One row per n8n resume webhook delivery; `needs_review_reasons[]` | 30 | `id` | Low — pipeline observability, useful as a freshness signal |
| `applications` | **Sole candidate↔job link**, carries `client_id` | 16 | `application_id` | **Primary for tenancy.** Candidate status per job, owner, stage, fit score; `unique(candidate_id, job_id)` |
| `candidate_client_fit` | Cross-job candidate↔client fit score | **0** | `id` | Designed for redeployment search; **empty**, so unusable today |
| `clients` | Client/tenant/workspace entity (`industry`, `plan`, `status`) | 4 | `client_id` | **Primary for tenancy.** Also the only place `industry` exists |
| `job_orders` | Requisitions (title, location, workplace_type, industry, job_function, salary band) | 2 | `job_id` | Medium — supplies the vocabulary an NL query mirrors |
| `job_target_companies` | Per-job target employer list (free text `name`) | 10 | `id` | Medium — nearest thing to a company vocabulary |
| `profiles` | App users; `side` (stellaforce/client), `client_id`, `role`, `client_role` | 6 | `id` | **Primary for tenancy** — the subject of any RLS predicate |
| `placements` | Completed placements | **0** | `placement_id` | Low today |
| `interactions` | Candidate touchpoints, `nurture_status` | **0** | `interaction_id` | Low today; would be the "candidate status" home |
| `activity_events` | Unified append-only log + outbox (has `candidate_id`, `client_id`) | 85 | — | Low for search; relevant for recency signals |
| `call_recordings`, `application_stage_evaluation*` | Interview evidence, transcripts, Q&A | 62 / 190 / 126 | — | Future: evidence-based search, not filterable today |

**Not present at all:** any `companies`/`employers` table, any `locations`/`geo` table, any normalized-title or occupation taxonomy, any saved-search / search-log table, any materialized view.

---

## 3. Candidate Search Fields

| Search need | Existing table.column | Data type | Data quality / completeness | Notes |
|---|---|---|---|---|
| **Name** | `candidates.first_name`, `.last_name`, `.full_name` | `text`, `text`, `text` **GENERATED ALWAYS AS (first_name \|\| ' ' \|\| last_name)** | 42/42 (both NOT NULL) | `full_name` is a stored generated column — ideal FTS/trigram target. **No index on it today.** |
| — headline | `candidates.headline` | `text` | 42/42 | Distinct from `current_title` in **all 42** rows — it is a real second field, not a mirror |
| **Current title** | `candidates.current_title` | `text` | 42/42 | Free text. 34 distinct (case-insensitive) values across 42 rows |
| — raw job title | `candidate_work_experiences.title` | `text` NOT NULL | 153/153 | Free text, 130 distinct across 153 rows |
| — normalized title | **Not found.** | — | — | No normalized-title column, lookup table, or taxonomy anywhere |
| — seniority | **Not found.** | — | — | *Likely* derivable: 22/42 current titles contain a seniority token (senior/sr/lead/principal/staff/head/director/VP/chief/manager) |
| **Past titles** | `candidate_work_experiences.title` where `is_current = false` | `text` | 127 of 153 rows are non-current | One-to-many; ordered by `display_order` (unique per candidate) |
| **City** | `candidates.location_city` | `text` | **36/42 (86%)** | 30 distinct values; no casing/whitespace duplicates detected |
| **Region/state** | `candidates.location_state` | `text` | **35/42 (83%)** | **Mixed format:** 28 values are 2-char codes, 7 are long-form names. 20 distinct values |
| **Country** | `candidates.location_country` | `text` | **40/42 (95%)** | **Mixed format:** 22 × 2-char, 14 × 3-char, 4 × 5-char. Only 4 distinct values — *likely* `US`/`USA`/one spelled-out country |
| — raw location | `candidates.location_raw` | `text` | 39/42 | Format mix: 20 `City, ST`; 9 other 2-part; 6 single token; 2 three-part; 3 null. **Zero** "Greater …"/"… Area"/"… Metro" phrasings found |
| — timezone | `candidates.timezone` | `text` | **0/42 — column exists, never populated** | |
| **Remote status** | `candidates.is_open_to_remote` / `.is_open_to_relocation` | `boolean` DEFAULT false | 14/42 true / **0/42 true** | These are *preferences*, not status. The 14 are *likely* exactly the QA fixtures (needs confirmation) |
| — remote work history | `candidate_work_experiences.is_remote` | `boolean` nullable | 28 of 153 rows non-null (18%) | Per-role, mostly unknown |
| — job-side equivalent | `job_orders.workplace_type` | enum `on-site \| hybrid \| remote` | — | The only true enum for remoteness; lives on the req, not the candidate |
| **Current company** | `candidates.current_company` | `text` | 42/42 | Free text. Agrees with the candidate's own current work-experience row in **23 of 26** current rows |
| **Past companies** | `candidate_work_experiences.company_name` | `text` NOT NULL | 153/153 | **128 distinct spellings** across 153 rows. No company entity, no canonical id, no dedup |
| **Skills** | `candidate_skills` → `skills.name` | join table + `text` | **28/42 candidates (67%)**; avg 22.3 skills each | Properly normalized, unique on `lower(name)`. `skills.category` is **0/556 populated**; `skill_type` is populated (263 technical / 259 functional / 34 behavioral) |
| — tools | `candidate_tools` → `tools.name` | join table + `text` | 25/42 candidates | `tools.category` **0/273 populated** |
| **Industry** | **Not found on candidate.** Exists as `clients.industry` and `job_orders.industry` (both free `text`) | — | — | Candidate industry would have to be inferred from employer or from the client of an application |
| **Total years of experience** | `candidates.years_experience` | `integer` | **42/42** | Stored scalar; no stated derivation rule. *Needs confirmation* whether it is maintained or set once at ingest |
| **Role-specific years of experience** | `candidate_skills.years_of_experience` | `integer` nullable | Population not measured per-row; column exists | Skill-scoped, not role-scoped. Role-scoped YOE must be **derived** from `candidate_work_experiences.start_date`/`end_date` |
| **Candidate status** | **Not found as a candidate-level field.** Nearest: `candidates.candidate_tier` (enum `gold\|silver\|bronze`, 14/42), `candidates.data_provenance` (enum, NOT NULL), `applications.status` (enum `active\|hired\|rejected\|withdrawn\|on_hold`, **per application, not per candidate**), `interactions.nurture_status` (table is **empty**) | — | — | A recruiter-facing "candidate status" has no home today |
| **Workspace/client visibility** | `applications.client_id` (NOT NULL, FK, indexed); `candidate_client_fit.client_id` (**0 rows**) | `uuid` | 15/42 candidates have ≥1 application; 2 of 4 clients have any | **`candidates` itself has no tenant column.** Visibility is join-derived or absent |
| — source | `candidates.source` | `text` (free, not an enum) | 42/42 | Two values in use: `resume_upload` (28) and `qa_test_fixture` (14) |
| — freshness | `.updated_at`, `.last_updated`, `.date_added`, `.created_at` (all NOT NULL, trigger-maintained) | `timestamptz` | **42/42** | Plus `last_verified` 28/42 and `freshness_score` 28/42 |

---

## 4. Relationships

```
candidates.candidate_id  (PK, uuid)
  → candidate_work_experiences.candidate_id   FK, CASCADE   one-to-many  (153 rows / 28 candidates)
  → candidate_skills.candidate_id             FK, CASCADE   one-to-many  → skills.id (FK, RESTRICT)   ⇒ many-to-many
  → candidate_tools.candidate_id              FK, CASCADE   one-to-many  → tools.id  (FK, RESTRICT)   ⇒ many-to-many
  → candidate_education.candidate_id          FK, CASCADE   one-to-many
  → candidate_certifications.candidate_id     FK, CASCADE   one-to-many
  → candidate_links.candidate_id              FK, CASCADE   one-to-many
  → resumes.candidate_id                      FK, CASCADE   one-to-many (partial-unique: one is_current per candidate)
  → applications.candidate_id                 FK, CASCADE   one-to-many (unique(candidate_id, job_id))
  → candidate_client_fit.candidate_id         FK, CASCADE   one-to-many (unique(candidate_id, client_id))  [0 rows]
  → placements.candidate_id                   FK, CASCADE   one-to-many  [0 rows]
  → interactions.candidate_id                 FK, CASCADE   one-to-many  [0 rows]
  → ingestion_jobs.candidate_id               FK, SET NULL  one-to-many
  → call_recordings.candidate_id              FK            one-to-many
  → activity_events.candidate_id              FK, SET NULL  one-to-many
  → ai_interactions.candidate_id              FK, SET NULL  one-to-many
  → interviews / interview_scheduling_requests / scheduled_agent_calls .candidate_id   FK, CASCADE

resumes.id
  → candidate_work_experiences.source_resume_id   FK, SET NULL   (provenance: which resume wrote this row)
  → candidate_education.source_resume_id          FK, SET NULL
  → candidate_certifications.source_resume_id     FK, SET NULL

clients.client_id  ── the tenant root
  → applications.client_id            FK, CASCADE   (the only populated candidate↔client path)
  → job_orders.client_id              FK, CASCADE   NOT NULL
  → profiles.client_id                FK, SET NULL  (nullable ⇒ Stellaforce-side users have none)
  → candidate_client_fit.client_id    FK, CASCADE   [0 rows]

job_orders.job_id
  → applications.job_id               FK, CASCADE
  → job_workflow_sub_stages.job_id    FK  →  applications.current_stage_id (FK, SET NULL)
  → job_target_companies.job_id       FK
```

| Parent | Child | Join columns | Enforced FK? | Relationship |
|---|---|---|---|---|
| `candidates` | `candidate_work_experiences` | `candidate_id` → `candidate_id` | **Yes** (CASCADE) | one-to-many |
| `candidates` | `candidate_skills` | `candidate_id` → `candidate_id` | **Yes** (CASCADE) | one-to-many |
| `skills` | `candidate_skills` | `id` → `skill_id` | **Yes** (RESTRICT) | one-to-many |
| `candidates` ↔ `skills` | via `candidate_skills` | — | **Yes**, both sides | **many-to-many**, `unique(candidate_id, skill_id)` |
| `candidates` ↔ `tools` | via `candidate_tools` | — | **Yes**, both sides | **many-to-many**, `unique(candidate_id, tool_id)` |
| `candidates` | `candidate_education` | `candidate_id` → `candidate_id` | **Yes** (CASCADE) | one-to-many |
| `candidates` | `candidate_certifications` | `candidate_id` → `candidate_id` | **Yes** (CASCADE) | one-to-many |
| `candidates` | `candidate_links` | `candidate_id` → `candidate_id` | **Yes** (CASCADE) | one-to-many, `unique(candidate_id, url)` |
| `candidates` | `resumes` | `candidate_id` → `candidate_id` | **Yes** (CASCADE) | one-to-many, **one-to-one where `is_current`** |
| `candidates` | `applications` | `candidate_id` → `candidate_id` | **Yes** (CASCADE) | one-to-many |
| `job_orders` | `applications` | `job_id` → `job_id` | **Yes** (CASCADE) | one-to-many |
| `clients` | `applications` | `client_id` → `client_id` | **Yes** (CASCADE) | one-to-many |
| `candidates` ↔ `job_orders` | via `applications` | — | **Yes**, both sides | **many-to-many**, `unique(candidate_id, job_id)` |
| `candidates` ↔ `clients` | via `candidate_client_fit` | — | **Yes**, both sides | many-to-many, `unique(candidate_id, client_id)` — **table empty** |
| `resumes` | `candidate_work_experiences` / `_education` / `_certifications` | `id` → `source_resume_id` | **Yes** (SET NULL) | one-to-many (provenance) |
| `clients` | `profiles` | `client_id` → `client_id` | **Yes** (SET NULL) | one-to-many |
| `candidates.current_company` | `candidate_work_experiences.company_name` | free-text string match | **No — implied only** | Agrees in 23 of 26 current-experience rows |
| `candidates.current_title` | `candidate_work_experiences.title` | free-text string match | **No — implied only** | Agrees in 22 of 26 current-experience rows |
| `job_target_companies.name` | `candidate_work_experiences.company_name` | free-text string match | **No — implied only** | Would power "worked at a target company" |

---

## 5. Search Components Already Present

- **Existing name search:** None in the database. `candidates.full_name` is a stored generated column (`first_name || ' ' || last_name`) and is the natural target, but it carries **no index of any kind**. Any name search today is a sequential scan with `ILIKE`.
- **Full-text search:** **None.** Zero `tsvector` columns in `public`; zero GIN indexes; no `to_tsvector` expression index; no text-search configuration or dictionary defined. `unaccent` is available in the image but **not installed**.
- **Vector/embedding search:** One column, `candidates.embedding_vector vector(1536)` (pgvector 0.8.2), backed by `idx_candidates_embedding` — *an ivfflat index using cosine distance with `lists = 100`, which lets Postgres find the nearest candidate vectors approximately instead of comparing against every row.* It is populated on 28 of 42 rows (all 28 `resume_upload` candidates; none of the 14 QA fixtures), and all 28 values are distinct. **However**, the project's own `CLAUDE.md` states `src/lib/ai/embeddings.ts` returns a deterministic placeholder because Anthropic has no embeddings endpoint — so these vectors vary per candidate but encode no meaning. *Needs confirmation against the current code, but the row counts are consistent with that claim.* There is also **no similarity RPC**, so nothing in the database can query this index today.
- **Relevant indexes** (candidate domain, all B-tree unless noted):
  - `candidates_pkey` on `candidate_id` — *identifies a candidate.*
  - `candidates_email_key` **UNIQUE** on `email` — *enforces one candidate per email address; also the ingestion identity key.*
  - `idx_candidates_tier` on `candidate_tier` — *the only filterable-attribute index on the candidate table, and it covers a column populated on 14 of 42 rows.*
  - `idx_candidates_added_by` on `added_by` — *finds candidates a given recruiter added.*
  - `idx_candidates_embedding` (ivfflat) — *approximate nearest-neighbour over the placeholder embeddings.*
  - `idx_candidate_skills_candidate` / `_skill` — *both directions of the skill join, so "which skills does X have" and "who has skill Y" are both indexed.*
  - `idx_candidate_tools_candidate` / `_tool` — *same, for tools.*
  - `skills_name_ci_key` / `tools_name_ci_key` **UNIQUE on `lower(name)`** — *makes the skill/tool vocabulary case-insensitively canonical, and incidentally makes exact case-insensitive skill-name lookup fast.*
  - `candidate_work_experiences_candidate_id_display_order_key` **UNIQUE** — *orders a candidate's roles; note there is **no standalone index on `candidate_id`** for this table, though the composite's leading column covers it.*
  - `idx_applications_candidate_id` / `_client_id` / `_job_id` / `_owner` / `_current_stage`, plus `applications_candidate_id_job_id_key` **UNIQUE** — *make the candidate↔client↔job tenancy join cheap in every direction.*
  - **Absent and load-bearing for the stated goal:** no index on `current_title`, `current_company`, `location_city`, `location_state`, `location_country`, `full_name`, `headline`, `years_experience`, `source`, `updated_at`, or on `candidate_work_experiences.title` / `.company_name`.
- **Search RPCs / functions / views:** **None.** Of the 8 non-pgvector, non-trigger functions in `public`, five are interview-scheduling RPCs (`confirm_interview_booking`, `hold_interview_slot`, `claim_due_agent_calls`, `claim_agent_call_for_interview`, `cancel_interview`) and three are RLS helpers (`current_profile_side`, `current_profile_client_id`, `current_profile_is_account_admin`). The single view, `interview_scheduling_request_status`, is a tenant-filtered projection of scheduling requests — unrelated to candidate search. **Zero Edge Functions are deployed.**
- **Relevant extensions:** Installed — `vector` 0.8.2 (public), `pgcrypto`, `uuid-ossp`, `btree_gist` (used only by the interview-overlap exclusion constraints), `pg_stat_statements`, `supabase_vault`. **Not installed but available in the image:** `pg_trgm`, `unaccent`, `citext`, `fuzzystrmatch`, `btree_gin`, `postgis`, `earthdistance`/`cube`. The four GiST indexes in `public` are all interview/slot-overlap exclusion constraints, not search indexes.

---

## 6. Data Quality Findings

**Scope caveat applying to everything below:** 14 of 42 candidates (33%) are `source = 'qa_test_fixture'` — placeholder rows the project documents as "not real people, delete before launch". They are the 14 with `candidate_tier` set, and the 14 with **no work experience, no embedding, no `last_verified`, and no `freshness_score`**. Several percentages below are materially better or worse depending on whether you count them.

- **Titles:** 42/42 candidates have a non-empty `current_title`; 34 distinct case-insensitive values across 42 rows — close to one spelling per candidate. 22 of 42 embed a seniority word in the title string; 8 contain an all-caps token (abbreviation-shaped), as do 28 of 153 experience titles; 5 contain a separator (` of `, ` at `, `,`, `-`, `|`) meaning the string carries more than one fact. In the specific "AE" case: 4 candidates spell out "account executive" and **zero** use the bare `AE` abbreviation — so abbreviation collapse is a *latent* risk here, not an observed one yet, but the 28 all-caps experience titles say it will arrive. There is **no normalized title, no seniority column, and no role-family/occupation taxonomy** — so `WHERE current_title = 'Account Executive'` is not a viable query shape.
- **Locations:** Split columns exist and are reasonably populated — city 36/42 (86%), state 35/42 (83%), country 40/42 (95%) — which is better than the usual free-text-blob starting point. But the values are **not normalized**: state is 28 two-letter codes vs. 7 long-form names (20 distinct values for 35 rows); country is 22 two-char, 14 three-char, and 4 five-char values (4 distinct values total — i.e. the same one or two countries written three different ways). `location_raw` (39/42) is format-mixed: 20 `City, ST`, 9 other two-part, 6 single-token, 2 three-part. Encouragingly, **no** "Greater …"/"… Area"/"… Metro" phrasings were found, and city values show no casing or whitespace duplicates (30 distinct either way). `timezone` exists and is **0% populated**. There is no geocoding, no lat/long, no metro/region concept, and no locations table — so "in Boston" cannot currently mean "Cambridge or Somerville".
- **Skills:** Structurally the strongest axis — a real join table against a global lookup with a case-insensitive unique constraint, indexed both directions. **Not** a JSON blob, not a text array, not buried in resume text. Coverage: 28/42 candidates (67%) have any skills, averaging 22.3 each — and the 14 without skills are exactly the fixture rows. Weaknesses: `skills.category` is **0/556 populated** and `tools.category` is **0/273**, so there is no skill grouping/hierarchy — 556 flat strings with no synonym, alias, or parent-child relation. `skill_type` *is* populated (263 technical / 259 functional / 34 behavioral) and is the only grouping available. Skills and tools are two separate vocabularies a recruiter's sentence will not distinguish between.
- **Work experience:** 28/42 candidates have any history (153 rows, avg 5.5 roles each); **14 candidates have none** (the fixtures). Date coverage is excellent: `start_date` is NOT NULL and present on 153/153; `end_date` on 127/153, with 26 rows flagged `is_current` — which accounts for the difference cleanly, so tenure and role-specific YOE are **computable today**. 25 candidates have a current role but there are 26 current rows, meaning **at least one candidate has two rows flagged current** — nothing in the schema prevents it (no partial unique index on `(candidate_id) WHERE is_current`, unlike `resumes`, which does have one). Per-role `location` is on 104/153 (68%), `employment_type` on 140/153, but `is_remote` on only 28/153 (18%). **Current role is stored on `candidates` *and* derivable from history, and the two disagree**: `current_company` matches the current experience row in 23 of 26 cases, `current_title` in 22 of 26 — roughly a 12–15% divergence with no rule saying which wins.
- **Tenant/client visibility:** Candidates are **global by construction** — no `client_id` on `candidates`, and the RLS policy `recruiters_all_candidates` is `FOR ALL TO authenticated USING (true) WITH CHECK (true)`. The same permissive shape covers `candidate_work_experiences`, `candidate_skills`, `candidate_tools`, `candidate_education`, `candidate_certifications`, `candidate_links`, `resumes`, `applications`, `clients`, `job_orders`, `placements`, `interactions`, `skills`, and `tools`. RLS is *enabled* on all of them; the predicate simply doesn't restrict. By contrast `activity_events` and `ai_interactions` carry genuine tenant predicates (`current_profile_side() = 'stellaforce' OR client_id IS NULL OR client_id = current_profile_client_id()`), and the `interview_scheduling_request_status` view filters the same way — so the codebase clearly knows the tenant-scoped pattern and has not applied it to the candidate domain. **Concrete risk:** 2 of the 6 existing profiles are `side = 'client'` (one `admin`, one `hiring_manager`). Signed in, either can `SELECT *` from `candidates` and read every candidate in the system — including the 27 candidates attached to no client at all and any candidate belonging to another client — along with email, phone, LinkedIn URL, and resume rows. **Any candidate-search endpoint built on the request-scoped anon client will inherit exactly this — RLS will not catch a missing tenant filter.** Also note the `applications` policy is `ALL`/`true`, so cross-client *writes* are equally unguarded.
- **Other concerns:**
  - **No candidate-level status exists.** `applications.status` is per-application (a candidate on two reqs has two statuses); `interactions.nurture_status` would be the candidate-level home but that table is **empty**; `candidate_tier` is populated only on the fixtures.
  - **`candidate_client_fit` is empty (0 rows)** despite being the designed cross-job "which clients suit this candidate" surface — so client-relationship filtering has only the `applications` path, which covers 15 of 42 candidates.
  - **No company entity.** 128 distinct `company_name` spellings across 153 rows, free text, no id, no dedup, no alias handling. `job_target_companies` (10 rows) is job-scoped and also free text.
  - **No industry on the candidate.** Only `clients.industry` and `job_orders.industry`, both free text.
  - **`years_experience` is a stored scalar with no visible derivation rule** (42/42 populated) that can silently drift from the work history it summarizes — the same class of problem as `current_title`.
  - `candidates` has **four dropped column slots** (ordinal positions 2, 3, 9, 10), consistent with the documented pre-V3.2 legacy shape. Harmless, but it means any column-ordinal-based tooling will misread the table.
  - Timestamps are in good shape: `created_at`, `updated_at`, `date_added`, `last_updated` are all NOT NULL and 42/42, trigger-maintained via `set_candidate_timestamps`. `last_verified` and `freshness_score` are 28/42 (absent on fixtures only). **None of them is indexed**, so "recently updated candidates first" is a sort over a full scan.
  - **Total data volume is ~42 candidates / 153 experiences / 625 skill links.** Every query is currently fast *because the tables are empty*, not because they are indexed. No index absence will manifest as a problem at this scale — which is precisely the trap.

---

## 7. What Is Safe To Build Next

Prioritized, not implemented:

1. **Decide the tenancy question before any query is written** — is candidate search global across Stellaforce, or filtered per client? The permissive `USING (true)` policy on `candidates` means this decision is currently made by accident, and the answer changes the shape of every subsequent item on this list.
2. **Establish canonical-source rules for `current_title` / `current_company` / `years_experience`** — stored-on-candidate vs. derived-from-history, with one winner. The 12–15% observed divergence will become search results a recruiter can prove wrong.
3. **Normalize location** — pick one representation for state and country (they are currently written 2–3 ways each), and decide whether "Boston" must match a metro area. Cheapest high-value fix: the split columns already exist and are 83–95% populated.
4. **Introduce a title-normalization layer** (canonical title + seniority + role family), since nothing in the schema can answer "account executives" today and no amount of indexing fixes that.
5. **Add the indexes the filter set actually needs** — trigram/FTS on name, title and company; B-tree on the location columns, `source`, and `updated_at`. `pg_trgm` and `unaccent` are available in the image but not yet installed.
6. **Populate `skills.category` (0/556) and `tools.category` (0/273)**, and decide whether skills and tools are one searchable vocabulary or two — a recruiter's sentence will not distinguish them.
7. **Resolve the embedding placeholder** — either wire a real provider (1536-dim keeps the column and ivfflat index as-is) or stop treating `embedding_vector` as a search asset. It currently looks populated and functional while carrying no signal, which is worse than an empty column.
8. **Choose where candidate-level status lives** (`interactions.nurture_status`, a new column, or explicitly "there is no such thing — status is per-application"), since you listed it as a required filter and it has no home.
9. Only after 1–8: build the NL→filters translation layer, which should target the *normalized* fields — otherwise the model is asked to guess spellings that the database itself does not agree on.

---

## 8. Raw Technical Appendix

### 8.1 Schemas
`auth` (23 tables), `extensions` (2 views), `graphql`, `graphql_public`, **`public` (57 tables, 1 view, 0 materialized views)**, `realtime` (2), `storage` (8), `supabase_migrations` (1), `vault` (1 table, 1 view).

### 8.2 `public.candidates` — full column list
`candidate_id uuid PK NOT NULL DEFAULT gen_random_uuid()` · *(ordinals 2, 3 dropped)* · `linkedin_url text` · `portfolio_url text` · `current_title text` · `current_company text` · `years_experience int4` · *(ordinals 9, 10 dropped)* · `languages text[]` · `professional_summary text` · `source text` · `candidate_tier candidate_tier` · `tier_rationale text` · `embedding_vector vector(1536)` · `data_provenance data_provenance NOT NULL DEFAULT 'ai_parsed'` · `freshness_score numeric` · `last_verified timestamptz` · `date_added timestamptz NOT NULL DEFAULT now()` · `last_updated timestamptz NOT NULL DEFAULT now()` · `created_at timestamptz NOT NULL DEFAULT now()` · `updated_at timestamptz NOT NULL DEFAULT now()` · `added_by uuid` · `first_name text NOT NULL` · `last_name text NOT NULL` · `email text` · `phone text` · `location_city text` · `location_state text` · `location_country text` · `location_raw text` · `timezone text` · `is_open_to_remote bool DEFAULT false` · `is_open_to_relocation bool DEFAULT false` · `github_url text` · `resume_path text` · `avatar_url text` · `source_metadata jsonb` · `data_confidence_score numeric` · `data_confidence_breakdown jsonb` · `last_scored_at timestamptz` · **`full_name text GENERATED ALWAYS AS ((first_name || ' '::text) || last_name) STORED`** · `headline text`

### 8.3 `public.candidate_work_experiences`
`id uuid PK` · `candidate_id uuid NOT NULL` · `display_order int4 NOT NULL` · `company_name text NOT NULL` · `title text NOT NULL` · `employment_type employment_type` · `location text` · `is_remote bool` · `start_date date NOT NULL` · `end_date date` · `is_current bool DEFAULT false` · `description text` · `created_at timestamptz NOT NULL` · `source_resume_id uuid`

### 8.4 Skills / tools
- `candidate_skills`: `id` · `candidate_id NOT NULL` · `skill_id NOT NULL` · `proficiency_level` · `years_of_experience int4` · `assessment_score numeric` · `scorecard jsonb` · `ai_literacy_signal jsonb` · `created_at`
- `skills`: `id` · `name text NOT NULL` · `skill_type skill_type NOT NULL` · `category text` *(0 populated)* · `created_at`
- `candidate_tools`: `id` · `candidate_id` · `tool_id` · `proficiency_level` · `created_at`
- `tools`: `id` · `name text NOT NULL` · `category text` *(0 populated)* · `created_at`

### 8.5 Tenancy-bearing columns
`applications`: `application_id PK` · `candidate_id NOT NULL` · `job_id NOT NULL` · **`client_id uuid NOT NULL`** · `status application_status NOT NULL` · `current_stage_id` · `owner_profile_id` · `job_fit_score numeric` · `human_review_flag bool NOT NULL` · `date_applied` / `date_updated` / `created_at` / `updated_at`

`profiles`: `id PK` · `email NOT NULL` · `full_name` · `role user_role` · **`side profile_side NOT NULL`** · **`client_id uuid`** · `client_role client_role`

`clients`: `client_id PK` · `client_name NOT NULL` · `status client_status NOT NULL` · `industry text` · `website_url` · `plan client_plan NOT NULL` · `notes`

### 8.6 Foreign keys (candidate domain)
```
candidate_work_experiences.candidate_id  → candidates(candidate_id)  ON DELETE CASCADE
candidate_skills.candidate_id            → candidates(candidate_id)  ON DELETE CASCADE
candidate_skills.skill_id                → skills(id)                ON DELETE RESTRICT
candidate_tools.candidate_id             → candidates(candidate_id)  ON DELETE CASCADE
candidate_tools.tool_id                  → tools(id)                 ON DELETE RESTRICT
candidate_education.candidate_id         → candidates(candidate_id)  ON DELETE CASCADE
candidate_certifications.candidate_id    → candidates(candidate_id)  ON DELETE CASCADE
candidate_links.candidate_id             → candidates(candidate_id)  ON DELETE CASCADE
resumes.candidate_id                     → candidates(candidate_id)  ON DELETE CASCADE
applications.candidate_id                → candidates(candidate_id)  ON DELETE CASCADE
applications.job_id                      → job_orders(job_id)        ON DELETE CASCADE
applications.client_id                   → clients(client_id)        ON DELETE CASCADE
applications.current_stage_id            → job_workflow_sub_stages(id) ON DELETE SET NULL
applications.owner_profile_id            → profiles(id)              ON DELETE SET NULL
candidate_client_fit.candidate_id        → candidates(candidate_id)  ON DELETE CASCADE
candidate_client_fit.client_id           → clients(client_id)        ON DELETE CASCADE
candidates.added_by                      → profiles(id)              ON DELETE SET NULL
ingestion_jobs.{candidate_id,resume_id,user_id} → candidates/resumes/profiles  ON DELETE SET NULL
{candidate_work_experiences,candidate_education,candidate_certifications}.source_resume_id → resumes(id) ON DELETE SET NULL
job_orders.client_id                     → clients(client_id)        ON DELETE CASCADE
profiles.client_id                       → clients(client_id)        ON DELETE SET NULL
```

### 8.7 Unique constraints worth noting
`candidates_email_key (email)` · `applications (candidate_id, job_id)` · `candidate_skills (candidate_id, skill_id)` · `candidate_tools (candidate_id, tool_id)` · `candidate_links (candidate_id, url)` · `candidate_work_experiences (candidate_id, display_order)` · `candidate_client_fit (candidate_id, client_id)` · `skills (lower(name))` · `tools (lower(name))` · `resumes (storage_path)` · `resumes (candidate_id) WHERE is_current`

### 8.8 RLS enabled status and policy names
RLS is **enabled on all 57 public tables**. Candidate-domain policies:

| Table | Policy | Cmd | Role | Predicate |
|---|---|---|---|---|
| `candidates` | `recruiters_all_candidates` | ALL | authenticated | `true` / `true` |
| `candidate_work_experiences` | `recruiters_all_candidate_work_experiences` | ALL | authenticated | `true` / `true` |
| `candidate_skills` | `recruiters_all_candidate_skills` | ALL | authenticated | `true` / `true` |
| `candidate_tools` | `recruiters_all_candidate_tools` | ALL | authenticated | `true` / `true` |
| `candidate_education` | `recruiters_all_candidate_education` | ALL | authenticated | `true` / `true` |
| `candidate_certifications` | `recruiters_all_candidate_certifications` | ALL | authenticated | `true` / `true` |
| `candidate_links` | `recruiters_all_candidate_links` | ALL | authenticated | `true` / `true` |
| `candidate_client_fit` | `recruiters_all_candidate_client_fit` | ALL | authenticated | `true` / `true` |
| `resumes` | `resumes: authenticated read/write` | ALL | authenticated | `true` / `true` |
| `applications` | `recruiters_all_applications` | ALL | authenticated | `true` / `true` |
| `clients` | `recruiters_all_clients` | ALL | authenticated | `true` / `true` |
| `job_orders` | `recruiters_all_job_orders` | ALL | authenticated | `true` / `true` |
| `placements` / `interactions` / `skills` / `tools` | `recruiters_all_*` | ALL | authenticated | `true` / `true` |
| `profiles` | `profiles_select_authenticated` | SELECT | authenticated | `true` (SELECT-only; no INSERT/UPDATE policy) |
| `activity_events` | `tenant_read_activity_events` | SELECT | authenticated | `current_profile_side() = 'stellaforce' OR client_id IS NULL OR client_id = current_profile_client_id()` |
| `activity_events` | `tenant_write_activity_events` | ALL | authenticated | `current_profile_side() = 'stellaforce' OR client_id = current_profile_client_id()` |
| `ai_interactions` | `tenant_read_ai_interactions` / `tenant_write_ai_interactions` | SELECT / ALL | authenticated | same tenant predicate as above |

### 8.9 Candidate/search-related functions
**None exist.** Non-pgvector, non-trigger functions in `public`:
- Scheduling: `confirm_interview_booking`, `hold_interview_slot`, `claim_due_agent_calls`, `claim_agent_call_for_interview`, `cancel_interview`
- RLS helpers: `current_profile_side() → profile_side`, `current_profile_client_id() → uuid`, `current_profile_is_account_admin() → boolean`
- Triggers: `handle_new_user`, `set_candidate_timestamps`, `set_application_timestamps`, `set_updated_at`
- Views: `interview_scheduling_request_status` (tenant-filtered projection of `interview_scheduling_requests`)
- Edge Functions: **0 deployed**

### 8.10 Extensions
**Installed:** `vector` 0.8.2 (schema `public`), `pgcrypto` 1.3, `uuid-ossp` 1.1, `btree_gist` 1.7, `pg_stat_statements` 1.11, `supabase_vault` 0.3.1, `plpgsql` 1.0.

**Available, not installed (search-relevant):** `pg_trgm`, `unaccent`, `citext`, `fuzzystrmatch`, `btree_gin`, `rum`, `pgroonga`, `postgis`, `cube`/`earthdistance`.

### 8.11 Read-only SQL used

All statements were `SELECT`s against system catalogs or aggregate counts. No DML, DDL, migration, extension install, index creation, or policy change was executed. No candidate names, emails, phone numbers, LinkedIn URLs, resume contents, titles, employers, or location strings were retrieved — the format findings come from regex classification and distinct-value *counts*.

```sql
-- Schema inventory
select nspname, count(c.oid) filter (where c.relkind='r'), ...
from pg_namespace n left join pg_class c on c.relnamespace = n.oid
where nspname not like 'pg_%' and nspname <> 'information_schema' group by 1;

-- Relations, sizes, RLS flag
select c.relname, c.relkind, (select reltuples::bigint from pg_class where oid=c.oid),
       pg_relation_size(c.oid), c.relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','v','m','p') order by c.relkind, c.relname;

-- Functions
select p.proname, pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid), p.prokind
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';

-- Columns (two batches: candidate domain, then tenancy/job domain)
select table_name, ordinal_position, column_name, data_type, udt_name, is_nullable,
       column_default, is_generated
from information_schema.columns
where table_schema='public' and table_name in (...) order by table_name, ordinal_position;

-- Exact row counts (18 tables in one scalar-subquery row)
select (select count(*) from candidates) as candidates, ... ;

-- Foreign keys
select c.conrelid::regclass::text, c.conname, pg_get_constraintdef(c.oid)
from pg_constraint c join pg_namespace n on n.oid=c.connamespace
where n.nspname='public' and c.contype='f' and (...);

-- Candidate field completeness (counts only)
select count(*),
       count(*) filter (where coalesce(nullif(trim(current_title),''),null) is not null), ...
from candidates;

-- Child-table coverage (distinct candidate counts only)
select (select count(distinct candidate_id) from candidate_skills), ... ;

-- Location FORMAT SHAPES (regex classes + distinct counts; no values returned)
select count(*) filter (where location_raw ~ '^[^,]+,\s*[A-Z]{2}$'), ... ,
       count(distinct lower(trim(location_city))), ...
from candidates;

select length(trim(location_country)), count(*)
from candidates where location_country is not null group by 1;

-- Title/company FORMAT SHAPES (regex classes + distinct counts; no values returned)
with t as (select trim(current_title) v from candidates where current_title is not null),
     w as (select trim(title) v from candidate_work_experiences)
select (select count(distinct lower(v)) from t),
       (select count(*) from t where v ~ '\m[A-Z]{2,4}\M'), ... ;

-- Indexes
select tablename, indexname, indexdef from pg_indexes
where schemaname='public' and tablename in (...);

-- RLS policies
select tablename, policyname, cmd, roles::text, qual, with_check
from pg_policies where schemaname='public' and tablename in (...);

-- Generated-column expression
select a.attname, pg_get_expr(d.adbin, d.adrelid)
from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
where a.attrelid='public.candidates'::regclass and a.attgenerated='s';

-- Search-capability probe (tsvector columns, GIN/GiST/ivfflat/hnsw indexes, vector columns)
select (select count(*) from pg_attribute a ... where a.atttypid='tsvector'::regtype), ... ;

-- Embedding population/variance (hashes and counts only — no vectors returned)
select count(*), count(distinct embedding_vector::text), count(distinct md5(embedding_vector::text))
from candidates where embedding_vector is not null;

-- Source mix, enum labels, profile mix, skill/tool category population
select source, count(*), count(*) filter (where embedding_vector is not null), ...
from candidates group by source;

select t.typname, string_agg(e.enumlabel, ' | ' order by e.enumsortorder)
from pg_type t join pg_enum e on e.enumtypid=t.oid ... ;

-- View definition
select pg_get_viewdef('public.interview_scheduling_request_status'::regclass, true);
```
