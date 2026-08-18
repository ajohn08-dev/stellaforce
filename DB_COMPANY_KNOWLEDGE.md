# Company knowledge — target schema and design audit

**No migrations exist for any of this.** The `/companies` workspace renders
entirely from `src/lib/mock-companies.ts`. This document is the design the DB
pass should implement, audited against what the app already does, plus the
places where the current design is **not** clean and would bite.

Cross-ref: [COMPANY.md](COMPANY.md) § D (entity model), [CLAUDE.md](CLAUDE.md)
(the placement rules), [DB_Schema.md](DB_Schema.md) (`clients`, `job_orders`,
`workflow_settings` — whose cascade this mirrors).

---

## A. The contract — what the schema has to support

Taken from the functions the UI actually calls, not from wishes.

### Reads

| Operation | Where | Shape |
|---|---|---|
| `companyQuestions` | every section, inbox | catalog **left join** company rows |
| `resolveAnswer(q, {jobId})` | job page, compile, readiness | narrowest scope wins over `job → team… → company` |
| `answerStack(q)` | company sections | every answer for one question, ordered by depth |
| `effectiveProhibitions` | question detail, compile | **union** of catalog + every scope in the chain |
| `allAnswers` | staleness, unverified sweeps | every written answer at a company |
| `compileAgentContext(job, audience)` | agent panel, agent config | one bundle: blocks, answers, policies, escalations, prohibitions, fallbacks |
| `unansweredItems` | inbox | company-answerable × 1, job-only × active roles |
| `jobCoverage` / `jobAnswerGaps` | jobs list, publish | per-role missing fields + unanswered questions |
| `teamPath` / `childTeams` / `jobsUnderTeam` | teams tree, compile, reach | recursive over `parent_team_id` |
| readiness + completeness | header, rail badges | counts over all of the above |

### Writes

| Operation | Notes |
|---|---|
| Edit any field | **Batched company-wide, applied by one Publish** |
| Bulk section visibility | Writes N items at once; skips deliberate overrides |
| Write a team- or job-scoped answer | Creates a row at that scope |
| `askedClientAt` | The waiting-on-client state |
| Publish | Atomic across every section + a version snapshot |

Two properties the schema must not lose:

- **Answers override; prohibitions accumulate.** Different resolution rules on
  the same walk.
- **Sibling isolation.** A candidate for a role on team X never receives team Y's
  knowledge. Enforced by resolving over `teamPath`, never over "all teams".

---

## B. The schema

### B.1 The catalog — shared across every customer

```sql
create table question_catalog (
  id              text primary key,          -- 'q-visa-sponsorship'
  client_id       uuid references clients,   -- null = global, set = this customer's own
  intent          text not null,
  category        faq_category not null,
  variants        text[] not null default '{}',
  sensitive       boolean not null default false,
  answerable_at   answer_scope_kind not null default 'company',  -- 'company' | 'job'
  only_for_job_id uuid references job_orders on delete cascade,  -- bespoke, one role
  default_agent_use agent_use not null default 'on_request',
  prohibitions    text[] not null default '{}',                  -- locked; accumulate
  created_at      timestamptz not null default now()
);
create index on question_catalog (client_id);
```

`client_id is null` is the global catalog. A customer's bespoke question carries
their id. **Nothing else is ever shared between customers** — see § D.6 of
COMPANY.md.

### B.2 Answers — the scoped part

```sql
create type answer_scope_kind as enum ('company', 'team', 'job');

create table company_answers (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients on delete cascade,
  question_id  text not null references question_catalog on delete cascade,

  -- Real foreign keys, not a generic (scope, scope_id) pair. There are exactly
  -- two possible parents, so both get a proper FK and the enum is derived.
  team_id      uuid references company_teams on delete cascade,
  job_id       uuid references job_orders    on delete cascade,
  scope        answer_scope_kind not null generated always as (
                 case when job_id  is not null then 'job'
                      when team_id is not null then 'team'
                      else 'company' end) stored,
  constraint one_scope check (num_nonnulls(team_id, job_id) <= 1),

  body                    text not null default '',
  expanded_answer         text,
  escalation_instructions text,
  prohibited_claims       text[] not null default '{}',

  -- visibility block, inline (see § D.3)
  clearance      clearance not null default 'cleared_for_candidates',
  agent_use      agent_use,
  state          publish_state not null default 'draft',
  source         text not null default '',
  verification   verification_status not null default 'unverified',
  last_verified_at date, verified_by uuid references profiles,
  owner_profile_id uuid references profiles,
  review_cadence_days int, next_review_at date,
  is_preset_default boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One answer per question per scope. Three partial indexes because NULLs don't
-- collide in a plain unique constraint.
create unique index on company_answers (client_id, question_id)
  where team_id is null and job_id is null;
create unique index on company_answers (question_id, team_id) where team_id is not null;
create unique index on company_answers (question_id, job_id)  where job_id  is not null;
```

**Why not the `workflow_settings` `(scope, scope_id)` pattern.** That table spans
four scopes whose ids live in four different tables, so a generic column was the
only option. Answers have exactly two possible parents — real FKs give cascade
deletes, referential integrity, and index-only scans, and the enum is generated
rather than trusted.

### B.3 Per-company question state

```sql
create table company_questions (
  client_id       uuid not null references clients on delete cascade,
  question_id     text not null references question_catalog on delete cascade,
  asked_client_at date,          -- waiting on the client, and since when
  primary key (client_id, question_id)
);
```

Note what is **not** here: `asked_count` and `last_asked_at`. See § D.2.

```sql
create table question_asked_events (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients on delete cascade,
  question_id text not null references question_catalog on delete cascade,
  job_id      uuid references job_orders on delete set null,   -- which role it was asked on
  application_id uuid references applications on delete set null,
  asked_at    timestamptz not null default now(),
  answered    boolean not null default false                   -- did the agent have an answer
);
create index on question_asked_events (client_id, question_id, job_id);
```

### B.4 Teams — self-nesting

```sql
create table company_teams (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients on delete cascade,
  parent_team_id  uuid references company_teams on delete cascade,
  name            text not null,
  mission         text,
  description     text,                    -- candidate-facing
  leader_id       uuid references company_stakeholders,
  size_range      text, operating_model text,
  locations       text[] not null default '{}',
  timezone_spread text, working_style text, collaboration_cadence text,
  day_in_the_life text, culture_notes text, internal_notes text,
  goals           text[] not null default '{}',
  cross_functional_partners text[] not null default '{}',
  common_role_families      text[] not null default '{}',
  created_because_job_id uuid references job_orders on delete set null,
  -- visibility block, inline
  ...
);
```

`job_orders` gains `team_id uuid references company_teams on delete set null`.

**Cycle safety.** `parent_team_id` self-reference means a cycle is possible.
`teamPath()` is already cycle-safe in TS; the DB needs the same guarantee —
either a trigger walking ancestors on update, or accept it and keep the walk
bounded. A recursive CTE without a cycle guard hangs.

### B.5 The rest

```sql
company_knowledge_items (id, client_id, kind, title, body, + visibility)
company_policies        (id, client_id, group, key, label, value,
                         immigration_value, candidate_facing_text, + visibility)
company_stakeholders    (id, client_id, name, title, role,
                         candidate_facing_bio, internal_notes, + visibility)
company_fallbacks       (client_id, kind, text, primary key (client_id, kind))
company_knowledge_versions (id, client_id, published_at, published_by,
                            change_count, summary)
```

Activity is **not** a new table — it's `activity_events` filtered by `client_id`,
which is what the workspace already treats it as.

---

## C. The three queries that carry everything

### C.1 Resolve every answer for one job

The whole cascade in one statement. `DISTINCT ON` + an ordering by scope rank is
exactly "narrowest wins".

```sql
with chain as (                                    -- the job's team and its ancestors
  select t.id, 1 as depth from company_teams t
    join job_orders j on j.team_id = t.id where j.job_id = $job
  union all
  select p.id, c.depth + 1 from company_teams p join chain c on p.id = (
    select parent_team_id from company_teams where id = c.id)
)
select distinct on (a.question_id)
  a.question_id, a.body, a.scope,
  coalesce(t.name, '') as source_name
from company_answers a
left join company_teams t on t.id = a.team_id
where a.client_id = $client
  and a.body <> ''
  and a.state = 'published'                         -- publishedOnly, for the compile
  and (a.job_id = $job
       or a.team_id in (select id from chain)
       or (a.job_id is null and a.team_id is null))
order by a.question_id,
         case a.scope when 'job' then 0 when 'team' then 1 else 2 end,
         (select depth from chain where id = a.team_id) nulls last;
```

Add `left join question_catalog` for intent/variants, and the compile is one
round trip.

### C.2 The freshness / unverified sweeps

```sql
select 'answer' as kind, id, client_id, clearance, state, verification, next_review_at
  from company_answers   where client_id = $client
union all select 'knowledge', id, client_id, clearance, state, verification, next_review_at
  from company_knowledge_items where client_id = $client
union all select 'policy', ...
union all select 'team', ...
union all select 'stakeholder', ...;
```

**Five-way union, every time.** See § D.3.

### C.3 The inbox

```sql
-- company-answerable, unanswered anywhere
select q.id, null::uuid as job_id
from question_catalog q
where (q.client_id is null or q.client_id = $client)
  and q.answerable_at = 'company'
  and not exists (select 1 from company_answers a
                  where a.question_id = q.id and a.client_id = $client and a.body <> '')
union all
-- job-only, one row per active role that lacks an answer
select q.id, j.job_id
from question_catalog q
cross join job_orders j
where (q.client_id is null or q.client_id = $client)
  and q.answerable_at = 'job'
  and j.client_id = $client and j.status in ('open','draft')
  and (q.only_for_job_id is null or q.only_for_job_id = j.job_id)
  and not exists (select 1 from company_answers a
                  where a.question_id = q.id and a.job_id = j.job_id and a.body <> '');
```

The derived answers (§ D.5) have to be subtracted from that second branch, which
is the awkward part.

---

## D. Where this is **not** clean

Five findings, worst first. Four are design problems; one is a bug already
shipped in the UI.

### D.1 ⚠️ Batched publish has no home in this schema — the biggest gap

The entire editing model is: **edit anything anywhere across the company, then
one Publish applies all of it and stamps a version.** The buffer currently lives
in React state (`company-draft-context.tsx`) keyed by field, and none of the
tables above have anywhere to put an unpublished edit.

`visibility.state = 'draft'` doesn't solve it — that's the *item's* publication
lifecycle (is this fact live?), not "this recruiter has three unsaved edits
across four sections".

Options, with the trade honestly stated:

| | How | Cost |
|---|---|---|
| **Staging table** | `company_draft_edits (client_id, author_id, field_key, value jsonb, section, label)`, publish applies and deletes | Matches the existing buffer exactly (it's already key/value/section/label). Needs a **dispatcher** mapping `field_key → table.column`, which is code that can drift from the schema. |
| Draft columns per table | `body_draft`, `clearance_draft`… | No dispatcher, but every table doubles its width and every read has to pick |
| Row versioning | Each row has a draft twin | Doubles rows; every query needs the published filter; deletes get subtle |
| Write-through + undo | Save immediately, version for revert | Simplest schema, **changes the product** — no Publish, no review-before-apply |

**Recommendation: the staging table**, and accept the dispatcher. The dispatcher
is one file with one exhaustive `switch`, and the alternative is either a
doubling of every table or abandoning the review-before-publish UX that the whole
workspace is built around. Guard the drift with a test that every `field_key`
prefix the UI can emit resolves to a real column.

### D.2 ⚠️ `asked_count` is company-wide but rendered per role — already a bug

`CompanyQuestion.askedCount` is one number per company. But `unansweredItems`
emits **one row per active role** for job-only questions, and each row renders
that same company-wide count. So a row reading *"How long will the process take?
— Senior Data Engineer · asked 6×"* may describe six asks that all happened on a
different req.

It also drives the "asked and unanswered" (amber) versus "never asked here"
(muted) split, so the distinction is wrong per role too.

**Fix:** `question_asked_events` (§ B.3), with counts derived per `(question,
job)`. That also gets, free: which roles a question is hot on, whether the agent
had an answer at the time, and a real "asked 6× on this role, 2 of them
unanswered".

### D.3 Visibility duplicated across five tables

Answers, knowledge items, policies, stakeholders, and teams each carry the same
eleven columns. Every sweep is a five-way union (§ C.2), and adding a twelfth
field means five migrations.

The alternative — one `knowledge_visibility (entity_type, entity_id, …)` table —
loses FK integrity, makes every read a join, and makes "delete the team, delete
its visibility" a trigger instead of a cascade.

**Recommendation: keep the duplication**, but make it a composite type or a
shared `like` template so the columns can't drift, and create a
`knowledge_items_v` view doing the union once so the sweeps have a single place
to read from. The duplication is real; hiding it behind an EAV table would be
worse.

### D.4 `companies` vs `clients` is still undecided

There is no `companies` table. The DB has `clients`; `/clients` redirects to
`/companies`; `job_orders.client_id` points at `clients`. Every table above says
`client_id` on that assumption.

Two readings, and they aren't equivalent:

- **A company profile *is* a client.** Add the knowledge columns to `clients`.
  Simplest, and true today. Breaks the day we want a company we don't have a
  contract with (a target account, a former client).
- **A company is its own entity**, `clients.company_id` points at it. One more
  join everywhere, but sourcing/target-account use cases work.

**Recommendation: extend `clients`** now and revisit only if target accounts
become real. The migration cost of splitting later is one `company_id` column
and a backfill; the cost of a speculative entity now is a join in every query
above.

### D.5 Derived answers are computed at read — with no trail

`derivedAnswers` synthesises job-scoped answers from `reportsTo`, `travel`,
`location`, `typicalWeek`, `rolePurpose`, and the pipeline. Nothing is stored,
which is the point: change the field and the answer follows.

The consequence is that **editing a job field silently changes what an agent
says, with no version entry and no review.** Someone edits the reporting line in
the job wizard; the next candidate hears a different sentence; nothing in the
company's activity log records it.

**Recommendation: keep deriving** (storing a copy is how the two drift), but emit
an `activity_event` when a derived answer's *input* changes, and show derived
answers in the Publish review as "will change because the role changed". The
alternative — materialising them on job save — reintroduces exactly the
duplication the derivation removed.

---

## E. What *is* clean

Worth stating, since the audit is otherwise a list of problems:

- **The cascade maps to one SQL statement** (§ C.1). No N+1, no application-side
  tree walk at request time.
- **Real FKs on answers** rather than a polymorphic id, so deletes cascade and
  the scope enum can't lie.
- **The catalog/answer split is the multi-tenant story.** One row per question
  globally; a new customer needs zero seeding; cross-customer rollups are one
  `group by question_id`.
- **Sibling isolation is structural**, not a filter someone has to remember: the
  resolve query joins the job's team chain, so an unrelated team can't appear.
- **RLS is the existing tenant-scoped pattern** — `client_id = current_profile_client_id()`
  on every table, `client_id is null` readable by all for the global catalog.
  Same shape as the workflow-settings tables.
- **Prohibitions accumulate by construction** — they're `text[]` on the catalog
  row and on each answer, unioned at read, so no scope can remove another's.

---

## F. Test run — scenarios against this design

Each scenario is walked as *what the UI does → what the DB does*. Three of them
surface problems the schema above gets wrong; those are marked ⚠️.

### F.1 A new customer is signed

**UI:** the profile opens with the whole catalog listed and nothing answered; the
inbox is the intake checklist; sensitive topics already escalate with their
prohibitions attached.

**DB:** one `clients` row. **Zero knowledge rows.** § C.3's first branch returns
every global question because no answer exists. Nothing to seed, nothing to
copy — which is the whole reason the catalog is global.

✅ Clean.

### F.2 A job is published from the wizard

**UI:** the role's knowledge instance appears immediately — questions it can
answer from its own fields, questions it needs, everything else inherited.

**DB:** one `job_orders` row with `team_id`. **Zero knowledge rows written.** The
"instance" is § C.1 plus the derived answers computed from the job's own columns.

✅ Clean — and the reason a req never needs provisioning.

### F.3 A recruiter answers a job-only question

**UI:** types into the row under *Needs an answer*, hits Publish.

**DB:** one insert into `company_answers` with `job_id` set, `state='published'`.
The partial unique index on `(question_id, job_id)` makes a second answer for the
same role an upsert rather than a duplicate.

⚠️ **But the write can't happen until Publish exists** (§ D.1). Today the value
sits in React state with nowhere to go.

### F.4 A recruiter bulk-changes a section's clearance

**UI:** picks "Recruiters only" on the section bar; items with their own setting
are skipped unless a second click includes them.

**DB:** `update company_answers set clearance = 'recruiters_only' where client_id = $c
and question_id = any($ids) and is_preset_default` — one statement, and the
`is_preset_default` predicate *is* the "leave deliberate settings alone" rule.
The mixed-type sections (policies, knowledge, teams) each need their own
statement, which is § D.3 again.

✅ Clean, given a publish path.

### F.5 A candidate asks something nobody has answered

**UI:** the agent uses the `unknown` fallback; the question appears in the inbox
with a count; if it's job-only it appears against that role.

**DB:** one insert into `question_asked_events` with `job_id` and
`answered=false`. Counts are derived. **This only works with § D.2's fix** —
today `asked_count` is a company-wide scalar and the per-role row shows the wrong
number.

⚠️ Broken as designed without the events table.

### F.6 An agent screens a candidate

**DB:** § C.1 once, plus the company's fallbacks, plus a prohibitions union.
Roughly three queries, no per-question round trips, and the result is the frozen
bundle the agent gets.

✅ Clean. Snapshot it at stage start if reproducibility matters — the same trick
`workflow_settings` uses at publish.

### F.7 A question is promoted into the global catalog

**UI:** a question first asked at one company becomes one every customer sees as
unanswered.

**DB:** update `client_id` from that customer's id to `null`. Every other
customer's § C.3 immediately returns it. Their answers are untouched because
answers key on `question_id`, which didn't change.

✅ Clean — and the compounding property that makes the catalog worth having.

### F.8 ⚠️ A global question is retired

**UI:** we stop asking every customer about something.

**DB as written above:** `company_answers.question_id references question_catalog
on delete cascade` — deleting the catalog row **destroys every customer's
answer**, silently, across the estate.

**Fix:** `on delete restrict`, plus `question_catalog.archived_at`. Retiring
hides it from new work; existing answers survive and stay auditable. A global
row should never be hard-deletable.

### F.9 ⚠️ A team with jobs under it is deleted

**DB as written above:** `job_orders.team_id references company_teams on delete
set null`. Deleting Go-to-Market silently detaches every role beneath it — and
because the compile walks `teamPath`, **what the agent says changes with no edit,
no version, and no warning.** `company_teams.parent_team_id on delete cascade`
makes it worse: deleting a parent takes every nested team and all of their
answers with it.

**Fix:** `on delete restrict` on both. COMPANY.md already specifies the product
behaviour — *"a department with linked jobs can't be deleted; the dialog lists
them and offers re-parenting"* — the FK should enforce it rather than leave it to
the UI.

### F.10 A job is closed

**UI:** it leaves the Jobs list, the scope menus, the inbox, and the publish
warnings.

**DB:** nothing is deleted. Every "active" view already filters
`status in ('open','draft')`. Its answers stay for audit and come back if the req
reopens.

✅ Clean.

---

## G. Verdict

**The read model is clean.** The cascade is one statement, the catalog/answer
split is what makes it multi-tenant, sibling isolation is structural rather than
a filter someone must remember, and real FKs on answers keep the scope honest.

**Three things need deciding before any migration is written:**

1. **How batched publish is stored** (§ D.1). Nothing else can be built until
   this is chosen — every write path depends on it.
2. **`asked_count` becomes an events table** (§ D.2). It is currently wrong on
   screen, not merely imprecise.
3. **`clients` versus a new `companies` table** (§ D.4).

**Two are hazards this audit found in the schema above**, and both are one word
each: `on delete cascade` from `question_catalog` (F.8) and
`on delete set null` / `cascade` around teams (F.9). Both would silently change
or destroy knowledge with no version entry. Both become `restrict`.
