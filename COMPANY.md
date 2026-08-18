# Stella Force — Company Profile Workspace

Design spec for the `/companies` route (formerly `/clients`). Cross-ref with
[CLAUDE.md](CLAUDE.md) (routes, stack conventions, interview channels),
[DB_Schema.md](DB_Schema.md) (`clients`, `job_orders`, `profiles`), and
[home.md](home.md) (the sibling per-profile spec, same documentation pattern).

**Status:** UI only. Every screen described here renders from typed mock data in
`src/lib/mock-companies.ts` — the same arrangement `/jobs` uses with
`src/lib/mock-jobs.ts`. No tables, migrations, or Server Actions exist for any of
this yet. The types are written in the shape the eventual schema should take, so
the database pass is a swap of the data source rather than a rewrite.

---

## What this is, and what it is not

A Company Profile is **not** a CRM record and **not** a marketing page. It is a
permission-aware knowledge base with two consumers:

1. **Recruiters**, who need company context once instead of re-entering it on every
   job order, and who need to answer candidate questions consistently.
2. **Candidate-facing AI screening agents**, which need verified, approved,
   disclosure-scoped context to conduct pre-screens and answer candidate questions
   without leaking anything commercial, legal, or compensatory.

The single hardest requirement is the **disclosure boundary**. A recruiter must be
able to look at any piece of information and know instantly whether a candidate may
hear it. Everything in the information architecture below serves that.

Company knowledge is **reusable across every job** for that company, and is
**inherited** by job orders (§ Product structure → relationship model). Departments
and teams exist only when an active job needs them; they are never mandatory.

---

# A. Product structure

## A.1 Sitemap

```
/companies                              Company list — table (default) or cards
  ?view=grid                            Card view
  /companies/new                        Setup flow (3 steps)
  /companies/[id]                       Company Profile workspace
      ?section=profile                  ← default landing section
      ?section=<key>                    Any of the 14 left-rail sections
      &team=<id>  &job=<id>             Drilldowns

Overlays (no route of their own — drawers, sheets, dialogs):
  Publish                               Review changes, preview agent context, apply
  Version history                       Company-wide published snapshots (UI only)
  Promote to draft                      Internal note → candidate-safe draft
  Create department / team              From Teams, or from job creation

Elsewhere in the app:
  /jobs/[id]  (draft wizard)            Inherited company context side panel
```

## A.2 Navigation model

`/companies` sits in the **bottom-pinned nav**, with Integrations, Workflows, and
Settings — not beside Jobs and Candidates.

```
MAIN NAV              BOTTOM NAV
  Home                  Companies
  Jobs                  Integrations
  Candidates            Workflows
  Chat                  Settings
```

The rule is **frequency of use, not richness**. A company profile is edited after
an intake call and revisited when a policy changes; Jobs and Candidates are opened
every day. Promoting Companies into the main nav on the grounds that it "became a
workspace" was the wrong instinct, and it was reverted. `/clients` redirects to
`/companies` permanently.

**Inside the workspace, navigation is a left rail of four collapsible groups** —
`company-workspace-nav.tsx`, driven by `company-sections.ts`. Not tabs: the content
is a tree (Departments → Teams, Jobs → one job), and tabs are flat and stop scaling
around five.

Only the group you're in is open on load, so the rail reads as five lines rather
than fifteen. Group headers roll up their children's gap badges, so a collapsed
group still tells you something is wrong inside it.

Below `lg` the rail collapses into a `Sheet` drawer behind a "Sections" button, so
the content column keeps full width.

**The whole workspace sits in a single white card** — `rounded-lg border bg-white`
inside a `p-4` shell, matching `/candidates/[id]`. The page chrome shouldn't compete
with content a recruiter is reading and editing.

## A.3 The left rail

```
  Unanswered questions      4      ← inbox, not reference material
  When the agent can't answer      ← four fallbacks, company-wide

▸ About the company         4      Profile · What they do ·
                                   Culture & working style · Why join
▸ Pay, benefits & policies  4      Locations & work model · Benefits ·
                                   Work authorization · Compensation approach
▸ Teams & jobs              2      Departments & teams › · Jobs ›
▸ Internal notes            2      Recruiter brief · Activity log
```

Section names are the words a recruiter says out loud. Earlier passes used
"Narrative", "Policies", and "Working here" — none of which anyone could decode
without being told, and the first reads as marketing for a knowledge base that must
be accurate.

**There is no FAQ library.** Questions live inside the section that answers them
(`faqSection()` in `src/lib/company-readiness.ts`) — sponsorship questions under Work
authorization, size questions under Profile. Editing the fact and editing the answer
to the question about that fact is one job; splitting them across two destinations
meant a recruiter updated one and forgot the other, which is how an agent ends up
confidently stating last year's policy. **Unanswered questions** stays separate
because it is a work queue, not reference material.

**Two annotations ride on each rail item:** a plain content count, and a **gap
badge** — red when the section holds a failed critical check, amber otherwise — plus
a small dot when items there have passed their review date. This is where a Readiness
screen would otherwise go; see § B.10.

## A.4 Company → Department → Team → Job

```
Company  (LumaGrid Security)
   │  always exists; created at intake
   │  owns: profile, narrative, policies, FAQ, recruiter brief
   │
   ├── Department  (Go-to-Market)                        OPTIONAL
   │      │  created only when an active job needs it
   │      │  owns: mission, leader, dept description, dept-level FAQ
   │      │
   │      └── Team  (Channel Growth)                     OPTIONAL
   │             │  created only when a role needs team-specific context
   │             │  owns: mission, hiring manager + bio, day-in-the-life,
   │             │        working style, team-level FAQ
   │             │
   │             └── Job  (Regional Channel Development Manager, Central)
   │                    owns: role-specific overrides + role FAQ
   │
   └── Job  (company-level, no department/team)          ALSO VALID
```

Four attachment shapes are all legal: company-only, company+department,
company+department+team, and — deliberately — a job created before its department
exists, which can be re-parented later without losing role-level content.
`Department.createdBecauseJobId` records which job caused a department to exist, so
the rule is enforceable rather than merely stated.

**Precedence when the agent resolves any fact** (highest wins):

```
1. Role override      (job)
2. Team context       (team)
3. Department context (department)
4. Company context    (company)
5. Safe fallback / recruiter escalation
```

Level 5 is not a failure mode — it is a designed answer. An unknown sponsorship
policy resolves to an escalation, never to a guess.

## A.5 Section tiers

| Section | Tier | Why |
|---|---|---|
| Profile | **Core** | Default landing. The facts every job and agent starts from. |
| What they do · Culture · Why join | **Core** | The candidate-safe story; most-edited after intake. |
| Locations · Benefits · Work authorization | **Core** | The three highest-frequency candidate questions. |
| Compensation · Interview process | Secondary | Important, but mostly policy statements that rarely change. |
| Unanswered questions | Inbox | A work queue, above the groups. Consulted when it has items. |
| Unanswered questions | Secondary | A work queue; consulted when it has items. |
| Departments & teams | Progressive | Empty by default and correct that way. |
| Jobs | Progressive | Coverage, not a directory: which roles an agent still can't screen for. |
| Recruiter brief | Gated | Internal-only; omitted for profiles without the capability. |
| Activity log | Progressive | Consulted during disputes and audits, not daily. |
| Publish | Overlay | The primary action, not a destination. |

---

# B. Screen-by-screen specification

Shared conventions across every screen below, stated once:

- **Responsive** — content column caps at `max-w-5xl` on reading-heavy tabs
  (Overview, Narrative, Readiness) and runs full-width on list-heavy ones (FAQ,
  Activity). Below `sm`, multi-column card grids collapse to one column, the tab
  strip scrolls horizontally with chevrons, and right-side panels move below the
  main content rather than disappearing. The page body never scrolls horizontally.
- **Permissions** — Stellaforce-side staff pass every gate (`can()` in
  `src/lib/permissions.ts` already behaves this way). Client-side profiles see
  candidate-safe content plus internal content scoped to their own client; they
  never see restricted content, and the Recruiter Brief tab is not rendered at all
  rather than rendered-and-disabled — a disabled tab advertises that private
  content exists.
- **Validation** — nothing blocks saving. An incomplete profile is the expected
  state after an intake call, so incompleteness is reported through readiness, never
  through a form error. Real validation errors are limited to malformed URLs,
  impossible dates, and publishing an item with an empty body.
- **Inline editing** — every field is edit-in-place. There is no company-wide "edit
  mode" and no giant form. "Edit profile" in the header is a convenience that focuses
  the first snapshot field, not a modal.

---

## B.1 Company list — `/companies`

**Five columns, not eight.** Industry, funding stage, and headquarters each had
their own column — three of reference material nobody scans, taking the width
from the one column anyone acts on, which was truncating mid-word. Industry and
HQ read fine as a subline under the name; stage moved to the profile, where it's
read once.

**"Agent status" named something that doesn't exist.** An agent attaches to a job
stage, never to a company. The column answers whether a screening agent could run
for this company's roles yet, so it says **Screening readiness**, and every label
states the consequence rather than the enum: *Ready to screen* · *Ready — some
topics escalate* · *Re-confirm before screening* · *Can't screen yet*. The
explanation sentence beneath wraps instead of clipping.

**"Complete" became "Knowledge"** — "complete for what?" was a fair question.

**Three colours, not four.** `ready_with_caveats` was sky blue with an eye icon,
which read as a different *category* rather than a shade of ready. It's a ready
state; the caveat is in the words. The palette now matches the message
vocabulary: fine, needs you, broken.

**Purpose.** Pick a company, and see at a glance which accounts have knowledge gaps
serious enough to block agent deployment.

**Primary user.** Stellaforce recruiter.

**Layout.** Page header, then a toolbar (search · readiness filter · view toggle),
then the active view. **The table is the default**; `?view=grid` gives cards.

Comparison is the job here — which accounts are blocked, which are stalest, which
carry the most open jobs — and comparison wants aligned columns. Cards were the
default in an earlier pass and read fine at three companies; at forty they stop
being scannable.

**Header.** `Companies` + count. Right side: `Add company` (primary).

**Table columns.** Company (logo + name) · Industry · Stage · Headquarters · Jobs ·
Owner · Complete (inline bar) · Agent status (readiness pill + its one-line reason).
Sortable on name, jobs, completeness, and status; **sorted worst-status-first on
load**, so whatever needs attention is on top without touching a control.

**Card view** carries the same fields in a roomier layout for browsing.

Search and the readiness filter live in the toolbar rather than inside either view,
so switching between them keeps your scope.

**Actions.** Open company · Add company · Create job (row menu) · Search · Sort by
name / readiness / active jobs / last verified.

**Empty state.** "No companies yet — Add your first company after a client intake
call. You only need a name and an industry to start." + `Add company`.

**Permissions.** Client-side profiles see only their own client's row, which makes
the list a one-row redirect; for those profiles the sidebar links straight to
`/companies/[their-id]` instead.

---

## B.2 Company setup — `/companies/new`

**Purpose.** Get from intake call to a usable company record in under two minutes.
Everything else is progressive enrichment inside the workspace.

**Primary user.** Stellaforce recruiter, immediately post-intake.

**Layout.** Centered single column with `StepProgressBar`
(`src/components/jobs/draft/step-progress-bar.tsx`) — the same three-state
progress bar the draft-job wizard uses.

**Steps.**

1. **Identity** — Company name (required), website, LinkedIn, industry,
   sub-industry, HQ, employee range, stage, account owner. Everything except the
   name is optional.
2. **Disclosure preset** — the company-wide default that seeds visibility across
   field groups. Three choices, each with a plain-language summary of what the agent
   will and won't say:

   | Preset | Default for narrative & benefits | Default for policies | Best for |
   |---|---|---|---|
   | **Conservative** | Internal only | Escalate | Regulated clients, or a company you don't know well yet |
   | **Standard** *(default)* | Candidate-safe, answer if asked | Candidate-safe, answer if asked | Most accounts |
   | **Open** | Candidate-safe, state proactively | Candidate-safe, answer if asked | Companies with strong public employer brand |

   No preset ever defaults compensation, sponsorship, or financial-stability items
   to candidate-safe. Those are always recruiter decisions.
3. **Quick intake** — an optional paste box for raw intake-call notes. Anything
   parsed out lands as **draft, unverified, internal-only** knowledge items for the
   recruiter to review, promote, and publish. Nothing pasted here is ever
   auto-published, and the step copy says so.

**Actions.** Back · Skip this step · Create company (last step) · Save and finish
later (available from step 1 onward).

**Validation.** Company name required. URL fields validated on blur, non-blocking.
Duplicate-name warning links to the existing company rather than refusing.

**Responsive.** `StepProgressBar` switches to `orientation="vertical"` below `sm`.

---

## B.3 Company Profile workspace — `/companies/[id]`

The shell that hosts all fifteen sections.

**Header** (`company-workspace-header.tsx`) — **identity and actions, nothing else.**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [logo] LumaGrid Security  ● Ready with caveats                               │
│        Physical security software · Growth-stage, private · Austin, Texas ·  │
│        150–200 employees · Hybrid · lumagrid.com ↗ · LinkedIn ↗ · Owner: AJ  │
│                                                                              │
│                            [Version history] [+ Job] [Publish 3 changes]     │
└──────────────────────────────────────────────────────────────────────────────┘
```

A header answers *who is this, and what can I do here*. Status is neither, and the
header had accumulated four rows of it — because every surface removed elsewhere
spilled its contents upward. Each of those signals already had a better home:

| Was in the header | Why it left | Where it lives |
|---|---|---|
| Readiness sentence (2 lines) | Said the same thing as the rail badge *and* the warning inside the section that would fix it — three times for one problem | Pill tooltip; the section warning |
| "13 answered · 4 unanswered" | Duplicated the rail's Unanswered inbox | Rail |

**Asked-and-unanswered is not the same as never-asked.** A catalog question
nobody at this company has been asked is a *prompt*; a question a candidate asked
and the agent couldn't answer is a *gap*. Rendering both in amber with "no answer
yet" made a brand-new company look like it was failing candidates it had never
spoken to — and taught people to ignore the colour. Never-asked rows read "not
asked here yet" in muted text, stay collapsed, and are counted separately in the
section heading.
| "Profile complete 95%" | Says how far along you are without saying where to act | The list page, where comparing companies is the job |
| "Cleared for candidates 92%" | Same | The list page |
| "Last verified 12 Aug" | A company-wide roll-up of a per-item field | Activity log |

The **readiness pill** stays: one chip, the same role `JobStatusBadge` plays on a
job, with the explanation in its tooltip for anyone who wants detail without
navigating.

**Header actions.**

- **Publish** — **the primary CTA.** Disabled with no pending edits; otherwise
  "Publish N changes" with a Discard beside it. Opens the review list.
- **Create job** — secondary. Carries the company id into the draft-job wizard.
- **Version history** — company-wide snapshots, one per publish. UI only.

**There is deliberately no "Deploy agent" action.** An earlier pass had one, and it
was fiction: agents attach to a job stage (`job_workflow_sub_stages.agent_id`), never
to a company, so there was nothing at this level to deploy. **Publishing is** the act
that makes company knowledge available to every agent running on that company's jobs
— there is no second "now send it" step, because agents assemble context at
conversation time from whatever is published. The real gate — "you can't switch on AI
screening for this job" — belongs on the job, where the agent is attached. That's the
missing link already flagged in [CLAUDE.md](CLAUDE.md).

There is likewise **no standalone "Preview what candidates can learn" button**. That
content is a collapsed disclosure inside Publish, shown at the moment it becomes true.

**Body.** Left rail (§ A.3) plus the active section. `?section=` drives it, so every
section is deep-linkable and inline "fix this" links can point straight at a gap.

**Permissions.** The internal group is omitted for profiles without the capability,
and a link to an internal section falls back to Profile rather than 404-ing — an
error page confirms the section exists.

---

## B.4–B.7 The Company and Working-here sections

Every section renders inside `SectionShell`: title, a one-line statement of what
belongs there, the section-wide visibility sentence, **any readiness warnings that
point at this section**, then the content, then the questions candidates ask about
it. Warnings sit above the content they concern rather than in a separate screen —
that is what dissolving the Readiness tab bought.

**Everything is editable in place.** `SectionShell` wraps its content in an
`EditableSection`, and every value is an `EditableText`, `EditableTextarea`,
`EditableSelect`, or `EditablePills` — controls that look like plain text until you
hover or focus them. A knowledge base you're reading shouldn't look like a form, but
nothing in it should be more than one click from editable.

**Editing is batched across the whole company, and Publish is the primary CTA.**
Edits collect in one buffer no matter which section they were made in; the header's
Publish button carries the running count and is the only thing that applies them.

That buffer lives in `layout.tsx`, not the page — section navigation is a
`?section=` change, which re-renders the page but preserves the layout, so unsaved
edits survive moving between sections while every section keeps a real URL. A
recruiter working through an intake call touches the profile, then benefits, then a
couple of questions: that's one act of maintenance and it should end in one Publish,
not four.

Publishing shows **what is about to change first**, grouped by section
("Benefits › Health benefits"). With edits batched across four or five sections a
bare confirm would ask you to remember what you did twenty minutes ago — the review
list is what makes company-wide batching safe rather than merely convenient.

**Leaving the company warns you.** The buffer is in memory only, so navigating away
discards it — the one place batching behind a single Publish turns from convenience
into a trap. `UnsavedChangesGuard` covers both exits: `beforeunload` for closing or
reloading the tab, and a capture-phase click interceptor for in-app links, since the
App Router has no navigation guard. Links *within* the company are deliberately not
intercepted — moving between sections is the normal way to work, and surviving that
is the entire point of the shared buffer.

Review labels are **short** — "Health benefits", "Health benefits wording", "Health
benefits access". Each control takes a long `ariaLabel` for screen readers and an
optional short `label` for this list; reusing the aria label produced entries like
"What a candidate hears about Health benefits", which is accurate and unreadable once
you have eight of them.

**Version history is company-wide** and **UI-only in this demo**: a publish is one
atomic act across every section, so a version is a snapshot of the company, never of
a section or an item. Restoring and diffing land with the database work.

**Visibility reads as a sentence, not badges** — *"Cleared for candidates, and the
agent answers only if asked"*, with the two clauses as inline dropdowns. The pair of
chips it replaced required translating jargon into a consequence before you knew what
would happen; here the sentence *is* the consequence.

The first clause is a **clearance level**, not a statement about who is looking at a
screen. Candidates have no login and never see this workspace; the only thing that
ever speaks to them is a screening agent. An earlier version read "Candidates can see
this", which described something that doesn't exist — and the fix was to let the
already-correct "Restricted" set the register for all three. The second clause only
exists once an item is cleared, since "how may the agent use this?" is meaningless for
something the agent never receives.

**Profile.** Identity, location, and business-shape fields as inline-editable rows
grouped in three cards. Below a labeled divider — *"Internal only — never shared
with candidates"* — the account block; below that, commercial terms in a
`RestrictedPanel`. The divider does work a badge can't: it tells you which *region*
of the page you're reading, so you don't have to check each field before speaking.

**What they do · Culture & working style · Why join.** One component
(`NarrativeSection`) over `knowledge-card` stacks, differing only in which
`KnowledgeKind`s route to each (`knowledgeSection()`). Blocks are edited in place —
no modal, no page-level edit mode, because filling this in after an intake call is a
dozen small edits across several sections. Empty blocks show the per-kind prompt from
`KNOWLEDGE_KIND_PROMPTS` plus `Add` and `Draft with AI`. Past 800 characters a hint
suggests splitting into an FAQ answer, since long blocks make agents ramble.

**Locations & work model · Benefits · Compensation approach.** One component
(`PolicySection`) over `policy-row` lists, filtered by `PolicyGroup`. Each row shows
the label, the value, and **the exact sentence a candidate would hear** — showing the
output rather than only the setting lets a recruiter check the wording without
simulating the agent in their head. A field that has never been filled says "Not yet
entered" and explains that this differs from "not offered"; conflating the two is how
an agent ends up denying a benefit that exists.

**Work authorization.** Same component, plus two things no other group needs. Every
item uses the explicit six-value enum, never free text:

| Value | Agent behavior |
|---|---|
| **Confirmed yes / no** | States the policy as written. |
| **Role-dependent** | Says it varies by role and defers to the job's policy. |
| **Case-by-case** | Says it is evaluated individually; predicts no outcome. |
| **Unknown — needs confirmation** | Uses the fixed fallback and escalates. |
| **Restricted** | Does not acknowledge the detail; escalates. |

Unknown rows render `UNKNOWN_FALLBACK` verbatim and **read-only**, so the recruiter
sees the literal sentence the candidate gets. Below the list, the standing
prohibition renders as a locked footnote — *"The agent may never guarantee or imply
visa sponsorship, visa eligibility, or any immigration outcome or timeline. This
holds regardless of how the fields above are set. It can't be switched off."* —
reading as a property of the system, not a setting someone chose.

---

## B.8 Departments & teams · Jobs

**Where a question lives is decided by one rule: where its answer can be true.**
`answerableAt: "company"` → the topical section that answers it.
`answerableAt: "job"` → the role, and *nowhere else*. That is why there is no
Interview process section: each job snapshots its own pipeline, so a company page
about "the process" could only host a sentence wrong for every role that doesn't
match it. Its contents went where each was true — pipelines to the job, the
never-promise-a-date rule into the catalog as locked prohibitions, the
client-reliability note to the Recruiter brief, and the readiness check from a
company-level "is there an interview answer" to a per-job `role_process`.

**Departments & teams.** `Department` is **gone** — merged into a self-nesting
`Team` (`parentTeamId`), so Go-to-Market › Channel Growth is two teams and depth
is data. That deletes a decision nobody could make correctly ("is this a
department or a team?"), lets a customer have one tier or four with no schema
change, and makes the rendered tree the org chart. One recursive component draws
every tier. Each team shows how many jobs inherit from it.

The one section whose **empty state is the correct state**:
*"No departments yet — that's fine. Company-level knowledge covers most roles. Create
a department when a job needs context this company profile can't provide."* Each
department card names the job that caused it to exist and nests its teams, each
showing how many jobs still use its context — the inverse of "Created for X", and what
makes an orphaned team visible instead of quietly accumulating;
`?team=<id>` drills into one, showing mission, hiring manager with candidate-safe
bio, day-in-the-life, working style, goals, and internal notes. A department with
linked jobs can't be deleted — the dialog lists them and offers re-parenting to
company level.

**Interview process.** The process is a property of the **job**, not the
company: each job snapshots its own pipeline at publish, so "the interview
process" is a different set of stages for every role. A company section inviting
prose about it invites a sentence that is wrong for half the roles — and the
candidate, not the recruiter, is who finds that out.

So the section leads with **the real pipelines, role by role** (read-only — a
pipeline has exactly one owner, and it isn't here), and keeps for itself only
what holds across every hire: the fallback a candidate hears when no role is in
play, the standing prohibition against promising an interview / offer / date, and
the internal note on how reliably this client runs whatever it agreed to. A role
with no stages yet says so in amber, because that's the case where the fallback
gets used and may be wrong.

**Jobs.** Not "Open jobs" — that named a filter the list never applied (it showed
every status while the rail counted open + draft), and the app says *Jobs*
everywhere else.

**The row is coverage, not a directory entry.** A title, a location, and "7 in
pipeline" is a jobs-dashboard row; `/jobs` already is that dashboard and owns the
data for it, so rendering it again here made this a duplicate that would drift the
moment both were real. What a knowledge base can answer that `/jobs` can't is *which
roles an agent still can't screen for, and why* — so each row carries the job's open
problems (`jobCoverage()`, derived from the same `JOB_CHECKS` array the readiness
checks use, so a row and a rail badge can't disagree): *No role purpose · No team
linked · 1 override conflicts with a verified company value*. Paused, filled, and
closed jobs aren't graded — nothing is screening for them — and say so.

**Two destinations per row, deliberately.** The **title** links out to `/jobs/[id]`,
the pipeline and candidates this domain doesn't own; **"What it inherits"** opens the
drilldown here. One card-wide link had to pick one, and picking the drilldown is what
left it a cul-de-sac: two screens about the same job that didn't know about each
other.

`?job=<id>` drills into what the job **inherits** (company narrative, benefits, work
authorization, FAQ; department mission; team context) and what it **overrides**. An
override shows the inherited value struck through beside the new one, with a one-click
revert — an override with the original hidden is indistinguishable from a plain edit.
Precedence is spelled out under the inherited list.

**⚠️ The two job models are not linked yet.** `/jobs` reads `job_orders` joined to
`clients`; this section reads `CompanyJob[]` from `mock-companies.ts`, with ids like
`job-lg-01` and no key in common. So the `/jobs/[id]` link is real markup against
fixture ids that won't resolve until the DB pass, where `CompanyJob.id` becomes
`job_orders.job_id` and title/location/status/comp are **read** from it rather than
stored a second time. What this domain legitimately owns is `overrides` and the role
narrative (`rolePurpose`, `typicalWeek`, `first90DayOutcomes`) — what an agent needs
and the job record doesn't hold. `CompanyJob.status` now uses the app's real job
vocabulary (`MockJobStatus`); it previously said `on_hold`, which is an *application*
status.

**Interview process.** The stages and timeline an agent may describe, plus the
internal notes on how reliably this client actually runs it. The standing prohibition
sits at the bottom: the agent may never promise an interview, an offer, a decision,
or a date. This is the section most likely to drift into commitment.

---

## B.9 Where the questions went

Each section ends with **"What candidates ask"** — the questions belonging to that
section and no others, routed by `faqSection()`. Collapsed to the question and how
often it's asked; expanded to the answer, the phrasings candidates use, escalation
instructions, and **prohibited claims** in a destructive-toned block, because that is
the field that makes compensation and sponsorship answerable at all. The approved
answer says what the agent may say; prohibited claims say what it may never say
however the question is phrased.

**Unanswered questions** stays a destination — an inbox above the rail groups.
Questions candidates asked that approved knowledge couldn't cover, ranked by
frequency: the knowledge base's to-do list, written by candidates rather than guessed
at. Each offers assign-an-owner, draft-an-answer, and **choose the level**, where
each option states its consequence ("Applies to every job at this company"). Getting
the level wrong doesn't just misfile an answer; it decides how many future jobs
inherit it.

---

## B.10 Where readiness went

There is **no Readiness section**. An earlier pass had one, and it duplicated the
completeness meter already in the header — two systems answering "how done is this",
one as a percentage and one as a checklist.

The same signals now appear in three places, each closer to the action they inform:

| Signal | Where | Source |
|---|---|---|
| Overall / candidate-safe completeness | The **list** page, for comparing companies | `readiness.completeness` |
| Whether this company is agent-ready at all | The header pill, one chip | `readiness.status` |
| Which sections have gaps | Rail badges — red = blocking, amber = to confirm | `gapCountsBySection()` |
| Which sections need re-confirming | Rail dots | `attentionSections()` — stale and unverified folded into one signal, since the action is identical |
| Which specific item needs it | An inline warning on that item, silent otherwise | `needsAttention()` — the same predicate the dots use |
| What exactly is wrong, and why it matters | Warning banners inside the section | `SectionShell` filters on `fixSection` |
| Why the profile isn't agent-ready | Stated under the company name, in plain sight | `readiness.headline` |
| What agents will know once published | Collapsed disclosure inside Publish | `compileAgentContext()` |

The status model is unchanged — **Ready to deploy · Ready with caveats · Recruiter
review required · Blocked** — and every check still carries a written explanation.
Color is a secondary cue throughout, never the message.

Two distinctions the check logic makes, both easy to get wrong:

- **Existence checks ignore staleness.** "Did you record this?" and "may the agent
  say it right now?" are different questions (`isPublishedCleared()` vs
  `agentCanUse()`). Conflating them reports a six-month-old profile as `blocked`,
  identical to a company that never had any knowledge at all.
- **Escalate-marked items assert nothing**, so they're exempt from both the stale
  sweep and the unverified-claims queue. "We don't know, ask a recruiter" can't
  expire and can't be unverified.

Critical deployment checks: company description · location and operating model ·
benefits or an approved fallback · work-authorization status · a candidate escalation
path · interview-process baseline · an approved company-size answer · an approved
culture answer. Per active job: compensation policy · reporting line · why the role
exists · travel and location. A company can be ready while a specific job is not.

---

## B.11 Activity log — and why there is no per-item history

**Purpose.** Answer "who said this, when, and on what basis" during a client
dispute or a compliance review.

**Layout.** Reverse-chronological feed with filters for actor, item, event type,
and date range.

**Event types.** Item created · edited · audience changed · agent-use changed ·
published · unpublished · verified · marked stale · cleared for candidates ·
restricted note expanded · agent deployed · agent used item in a candidate
interaction.

**There is deliberately no per-item history drawer.** An earlier pass hung one off
every knowledge card, and it conflated two different jobs:

| Question | How often | Where it's answered |
|---|---|---|
| *Who said this, and when was it last confirmed?* | Constantly | **Provenance** — the `VerificationRow` already inline on every card |
| *Reconstruct what happened during a dispute* | Rarely | **Audit** — this one feed, filtered |

Provenance is not an audit trail. Treating them as one thing cost a third parallel
history store, a denormalized `historyCount` on every item just to render
"History (3)", and a control on every card that usually opened to nothing. Filtering
the single feed covers the rare case without any of that.

**Storage.** This feed is a **projection**, not a company-owned table. The app
already has one append-only log — `activity_events` plus `audit_log`
([CLAUDE.md](CLAUDE.md)) — and company knowledge changes emit into it like
everything else. Nothing about company knowledge needs its own history mechanism.

**Retention.** Append-only; never edited or deleted.

---

## B.12 Job creation and inheritance

Only the company-relationship portion of the job flow is in scope here.

**Flow.** Select company → Review inherited knowledge → Select or create department,
or skip → Select or create team, or skip → Role profile → Role-specific candidate-safe
context → Internal brief and rubric → Review agent readiness → Launch screening agent.

**The inherited-context side panel** is the piece that matters. It sits on the right
of the draft-job wizard and lists, grouped by source level:

```
INHERITED FROM COMPANY                            LumaGrid Security
  Company narrative              ✓ 6 published blocks
  Benefits                       ✓ 11 items
  Work authorization             ⚠ H-1B new petition: unknown
  Location policy                ✓ Hybrid (Austin) / remote (approved field roles)
  Candidate FAQ                  ✓ 18 approved answers
  Culture narrative              ✓ Published

INHERITED FROM DEPARTMENT                             Go-to-Market
  Department mission             ✓ Published

INHERITED FROM TEAM                                 Channel Growth
  Team context                   ✓ Published
  Hiring manager bio             ✓ VP of Channel Growth
  Day in the life                ✓ Published
  Team FAQ                       ✓ 4 approved answers

OVERRIDDEN AT ROLE LEVEL                                        3
  Travel                         40–60%          (company: not specified)
  Location                       Central US remote   (company: Austin hybrid)
  Sponsorship                    Case-by-case        (company: unknown)
```

Inherited values render with an `inheritance-badge` naming their source level.
Editing one converts it to an `override-badge` with the inherited value still shown
struck-through, and a one-click revert. Conflicts — a role override that contradicts a
verified company policy — surface as a warning in readiness, not as a block, because
the override is frequently the correct answer.

**Department/team steps** each offer three paths: pick an existing one, create one
inline via the create-on-demand dialog, or skip. Skip carries the explanatory copy:
"You can add role-specific context on the job itself without creating a department or
team."

---

# C. UI component inventory

All under `src/components/companies/`, built on the existing `src/components/ui/`
primitives (Badge, Popover, Sheet, Dialog, Progress, DropdownMenu, Table, Textarea).
No new dependencies.

| Component | Purpose | Key states |
|---|---|---|
| `clearance-badge` | Compact clearance indicator. | Candidate-safe · Internal only · Restricted |
| `visibility-sentence` | Visibility as one readable sentence with inline dropdowns: "Cleared for candidates, and the agent answers only if asked". | Cleared · recruiters-only · restricted · escalating · read-only |
| `section-visibility-bar` | The same sentence applied section-wide, reporting how many items keep their own setting. | Uniform · mixed |
| `editable-field` | `EditableText` · `EditableTextarea` · `EditableSelect` · `EditablePills` · `FieldRow`. Look like text until hovered or focused. | Empty · filled · focused · reset |
| `company-draft-context` | The company-wide draft buffer + `useDirtyField`. Lives in `layout.tsx` so edits survive section navigation. | Clean · dirty · discarding |
| `field-scope` | Supplies a field its section, so a pending change reads "Benefits › Health benefits" without every call site threading it. | — |
| `publish-bar` | `PublishButton` (primary CTA, running count, review-before-publish dialog) + `CompanyVersionHistory` (company-wide, UI-only). | No changes · pending · reviewing · never published |
| `set-company-breadcrumb` | Registers "Companies › {name} › {section}" in the app header. | — |
| `knowledge-status-badge` | Publication + verification state. | Draft · In review · Published · Needs re-verification · Stale · Archived |
| `trust-warning` | The one on-item trust signal — renders **nothing** unless the item is stale or an unconfirmed candidate-facing claim. Exports `needsAttention()` so the rail dots can't disagree with it. | Silent · stale · unverified |
| `knowledge-card` | Candidate-safe content block with inline editing. | Empty · draft · published · stale · read-only |
| `internal-note-card` | Internal-only note. | Default · promotable · read-only |
| `restricted-panel` | Collapsed container showing reason, not content. | Collapsed · expanded (logged) · count-stub · hidden |
| `section-questions` | "What candidates ask" — the questions belonging to one section, answered and unanswered, collapsible and editable in place. Exports `QuestionRow`, which the Unanswered inbox renders too. | Empty · collapsed · expanded · unanswered · waiting on client · handed off |
| `section-shell` | The frame every section renders in: title, purpose, visibility sentence, readiness warnings pointing here, and the publish bar. | With warnings · clean · dirty |
| `field-card` | A titled group of `FieldRow`s. | With title · bare |
| `company-workspace-nav` | The rail: four collapsible groups plus the Unanswered inbox, with gap badges, stale dots, and rolled-up counts on collapsed groups. | Desktop rail · mobile drawer · group open/closed · internal group hidden |
| `policy-row` | A policy plus the exact sentence a candidate would hear. | Set · unknown (fixed fallback) · restricted · not entered |
| `inheritance-badge` | "Inherited from Company / Department / Team". | One per level |
| `override-badge` | "Overridden at role level" + inherited value + revert. | Override · conflicting override |
| `promote-to-draft-button` | Internal note → candidate-safe draft composer. | Default · disabled (restricted note) |
| `department-team-picker` | Select / create / skip, used in the job flow and the Teams section. | Empty · populated · creating |
| `create-department-dialog` / `create-team-dialog` | Create-on-demand, minimal required fields. | Default · from-job-flow |
| `readiness-pill` | The four-value status chip; explanation rides in a tooltip. | Ready · caveats · review · blocked |
| `company-version` | A published snapshot of the whole profile: when, by whom, how many changes. | — |
| `companies-table` | The default list view, sorted worst-status-first. | Sorted · filtered · empty |
| `companies-cards` | The `?view=grid` alternate. | Populated · empty |
| `activity-row` | One row of the company activity feed. | User event · system event · restricted-note open |
| `disclosure-preset-picker` | Conservative / Standard / Open with consequence summaries. | Setup · re-apply |

---

# D. Data model recommendation

Written as the target schema. In this pass these are TypeScript types in
`src/lib/mock-companies.ts` and `src/lib/company-visibility.ts`; the field names are
chosen to survive into Postgres unchanged.

## D.0 The shared visibility block

Every knowledge-bearing entity embeds this. It is the spine of the whole feature.

```ts
type Clearance  = "cleared_for_candidates" | "recruiters_only" | "restricted"
type AgentUse   = "proactive" | "on_request" | "reference_only" | "escalate"
type PublishState = "draft" | "in_review" | "published"
                  | "needs_reverification" | "archived"
type VerificationStatus = "verified" | "needs_review" | "unverified" | "stale"

type VisibilityBlock = {
  clearance: Clearance
  agentUse: AgentUse | null        // null unless clearance === "cleared_for_candidates"
  state: PublishState
  source: string                   // "Client intake call, 4 Aug 2026"
  verification: VerificationStatus
  lastVerifiedAt: string | null
  verifiedBy: string | null
  ownerProfileId: string
  reviewCadenceDays: number | null
  nextReviewAt: string | null
  isPresetDefault: boolean         // false once manually overridden — drives
                                   // the bulk menu's override count
}
```

**The agent gate is one predicate**, and it is the only place this decision is made:

```ts
agentCanUse(v) =
  v.clearance === "cleared_for_candidates" &&
  v.state === "published" &&
  v.verification !== "stale" &&
  v.agentUse !== "escalate"        // escalate items contribute an escalation
                                   // instruction, never an answer
```

## D.1 Company

| Field | Notes |
|---|---|
| `id`, `slug` | |
| `preferredName`, `legalName` | Preferred is what the agent says. |
| `website`, `linkedinUrl`, `logoPath` | |
| `headquarters`, `officeLocations[]`, `countriesOfOperation[]` | |
| `industry`, `subIndustry`, `stage`, `foundedYear`, `employeeRange` | |
| `operatingModel` | `remote` · `hybrid` · `onsite` · `mixed` |
| `publicDescription`, `mission`, `evp`, `differentiators[]` | Candidate-safe. |
| `productCategories[]`, `customerTypes[]`, `verticals[]` | |
| `accountOwnerProfileId`, `contractStatus`, `searchExclusivity` | Internal. |
| `relationshipHealth`, `internalPriority`, `responsivenessNotes` | Internal. |
| `disclosurePreset` | `conservative` · `standard` · `open` |
| `createdAt`, `updatedAt` | |

**Relationships.** `hasMany` Department, Job, CompanyKnowledgeItem, FAQEntry, Policy,
Stakeholder.

**Visibility.** Field-group level: the identity/narrative groups carry candidate-safe
defaults, the account group is always internal, and `contractStatus` /
`searchExclusivity` are restricted.

**Versioning.** `updatedAt`, plus an `activity_events` row per change. No
per-entity history column.

**LumaGrid.** `preferredName: "LumaGrid Security"`, `stage: "growth_private"`,
`headquarters: "Austin, Texas"`, `employeeRange: "150-200"`,
`operatingModel: "hybrid"`, `industry: "Physical security software"`,
`subIndustry: "Video management systems"`, `productCategories: ["Open-platform VMS",
"Cloud device management", "AI-assisted incident search"]`, `customerTypes:
["Security integrators", "Enterprise security teams", "Education", "Healthcare",
"Logistics", "Multi-site retail"]`, `disclosurePreset: "standard"`.

## D.2 CompanyKnowledgeItem

The narrative blocks and internal brief notes — one table, distinguished by `kind`.

| Field | Notes |
|---|---|
| `id`, `companyId` | |
| `level` | `company` · `department` · `team` · `job` |
| `levelRefId` | Null at company level. |
| `kind` | `one_liner` · `story` · `mission` · `product_overview` · `why_hiring` · `evp` · `culture` · `leadership_principles` · `career_growth` · `differentiators` · `customer_impact` · `market_positioning` · `why_join_now` · `role_family_context` · `brief_note` |
| `title`, `body` | |
| `visibility` | The shared block. |
| `promotedFromItemId` | Set when created via promote-to-draft. |

**LumaGrid `one_liner`.** *"LumaGrid helps security teams manage mixed-camera
environments without being locked into a single hardware vendor."* —
`clearance: cleared_for_candidates`, `agentUse: proactive`, `state: published`,
`source: "Client-approved boilerplate"`, `verification: verified`,
`lastVerifiedAt: "2026-08-12"`.

**LumaGrid `brief_note`.** *"VP Channel Growth reschedules first-round interviews
roughly a third of the time. Set candidate expectations accordingly and confirm slots
48 hours out."* — `clearance: recruiters_only`, `agentUse: null`, `state: published`.

## D.3 Department

`id` · `companyId` · `name` · `mission` · `executiveLeaderStakeholderId` ·
`candidateSafeDescription` · `sizeRange` · `operatingModel` ·
`crossFunctionalPartners[]` · `commonRoleFamilies[]` · `whatWeDoNarrative` ·
`internalNotes` · `visibility` · `createdBecauseJobId`.

`createdBecauseJobId` is the field that enforces the product rule — a department
records which job caused it to exist, so the Teams tab can explain itself and orphaned
departments are detectable.

**LumaGrid.** Go-to-Market — *"Build scalable revenue through direct sales, channel
partnerships, customer expansion, and market development."* `createdBecauseJobId:
"job-lg-01"`.

## D.4 Team

`id` · `departmentId` · `name` · `mission` · `hiringManagerStakeholderId` ·
`managerBioCandidateSafe` · `sizeRange` · `locations[]` · `timezoneSpread` ·
`workingStyle` · `collaborationCadence` · `dayInTheLife` · `keyStakeholders[]` ·
`goals[]` · `cultureNotes` · `internalNotes` · `visibility` · `createdBecauseJobId`.

**LumaGrid.** Channel Growth — *"Recruit, enable, and grow strategic security
integrator and distributor relationships across the United States."*

## D.5 Job (company-relationship fields only)

`id` · `companyId` · `departmentId?` · `teamId?` · `title` · `location` · `travelPct` ·
`reportsToStakeholderId` · `rolePurpose` · `compensation` · `sponsorshipPolicy` ·
`typicalWeek` · `first90DayOutcomes` · `roleRisks` · `overrides[]` (InheritanceOverride)
· job-scoped `Answer` rows (see D.6).

**LumaGrid.** Regional Channel Development Manager, Central — location *"Texas
preferred; remote within the Central United States"*, `travelPct: "40–60%"`, reports to
VP of Channel Growth, `compensation: "$115K base; $200K OTE; uncapped commission"`,
`sponsorshipPolicy: "case_by_case"` with the internal note *"H-1B transfer may be
considered for candidates already authorized to work in the United States, subject to
legal review. Do not promise sponsorship."*

## D.6 Question · CompanyQuestion · Answer

**`FaqEntry` is gone.** It fused a question and an answer into one row owned by
one company, which is why customer #2 retyped the same twenty questions, drifted
on categories, and invented their own prohibited-claims list. A question is the
same question everywhere; only the answer differs.

**`Question`** (`src/lib/question-catalog.ts`) — `id` · `scope` (`global` |
`company`) · `intent` · `variants[]` · `category` · `sensitive` ·
**`answerableAt`** (`company` | `job`) · `defaultAgentUse` · `prohibitions[]`.

`answerableAt: "job"` marks a question with **no truthful company-wide answer** —
*"How long will the process take?"* depends on the role's pipeline and how fast
this client moves. The stack skips the company row entirely and opens one row per
active role, so the UI stops asking for a sentence that would be a promise made
on behalf of every role at once. (Eventually derivable from
`job_workflow_sub_stages` + the job's resolved `sla_policies`; not derived yet,
because the mock has stage names and no durations and inventing one is the exact
false promise the flag prevents.) **The one thing shared across every
customer.** Company-scoped entries exist for the genuinely bespoke (*"Is the
Central territory greenfield?"*) and should stay rare — anything a second
company would recognise belongs in the global catalog, where every customer gets
it.

**`CompanyQuestion`** — `questionId` · `askedCount` · `lastAskedAt` ·
`askedClientAt` · `answers[]`. Derived, not stored per customer:
`companyQuestions()` projects the catalog onto a company and synthesises an empty
row wherever there's nothing recorded (a left join, in DB terms). That's what
makes a new customer's Unanswered inbox an intake checklist on day one.

**`Answer`** — `id` · `scope` (`company` | `team` | `job` + `refId`) · `body` ·
`expandedAnswer` · `escalationInstructions` · `prohibitedClaims[]` ·
`visibility`. The visibility block lives here, not on the question: clearance,
verification, and review cadence describe a *claim*, and only an answer makes
one.

**Resolution** (`src/lib/company-inheritance.ts`) — `global → company → team …
team → job`, the same cascade `workflow-settings.ts` uses. **Answers override**
(nearest wins); **prohibitions accumulate** (unioned from the catalog and every
scope in the chain, never removable). `resolveAnswer` is called by the UI, by
readiness, and by the agent compile, so what the screen says the agent will say
and what it says cannot diverge.

**Never shared between customers:** answers. Not as templates, not as "copy from
a similar company." Questions, phrasings, categories, and prohibitions travel;
answers never do.

**This type covers unanswered questions too** — there is no second type for them
(see D.10). An unanswered question is an entry with an empty `approvedAnswer`
and `visibility.state = "draft"`, so every published-only sweep (agent context,
staleness, unverified claims) skips it for free: a question with no answer
asserts nothing. `isUnanswered()` in `src/lib/company-readiness.ts` is the whole
test, derived and never stored. `askedClientAt` is the one state worth keeping —
we're blocked on someone outside the tool, and since when.

**LumaGrid, sponsorship.** `questionIntent: "Do you sponsor visas?"`,
`questionVariants: ["Can you sponsor H-1B?", "Do you do green card sponsorship?",
"Will you transfer my H-1B?"]`, `approvedAnswer: "Work authorization is evaluated per
role. For this role, an H-1B transfer may be considered for candidates already
authorized to work in the United States, subject to legal review."`,
`prohibitedClaims: ["Never state or imply that sponsorship is guaranteed", "Never
predict an immigration outcome or timeline", "Never advise on immigration eligibility"]`,
`escalationInstructions: "If the candidate asks about a new H-1B petition or a
green-card timeline, hand off to the recruiter."`, `agentUse: "on_request"`.

## D.7 Policy

`id` · `companyId` · `group` (`employment` · `benefits` · `immigration` ·
`mobility` · `internal`) · `key` · `valueType` (`text` · `boolean` · `enum` ·
`currency`) · `value` · `immigrationValue?` (`confirmed_yes` · `confirmed_no` ·
`role_dependent` · `case_by_case` · `unknown` · `restricted`) · `candidateFacingText` ·
`fallbackText` · `visibility`.

**LumaGrid.** `key: "h1b_transfer"`, `immigrationValue: "case_by_case"`,
`candidateFacingText: "H-1B transfers may be considered for candidates already
authorized to work in the US, subject to legal review."`, `verification: verified`.
`key: "h1b_new_petition"`, `immigrationValue: "unknown"` — this single row is what
holds LumaGrid at **Ready with caveats** rather than **Ready to deploy**.

## D.8 Stakeholder

`id` · `companyId` · `departmentId?` · `teamId?` · `name` · `title` · `role`
(`exec_leader` · `hiring_manager` · `hr_admin` · `client_recruiter` · `interviewer`) ·
`candidateSafeBio` · `internalNotes` · `contactInfo` (internal) · `visibility`.

**LumaGrid.** VP of Channel Growth — candidate-safe bio published; internal note
("reschedules first rounds often") internal-only.

## D.9 Activity — reuses `activity_events`, no new entity

Company knowledge changes emit into the **existing** append-only log rather than a
company-specific one: `entityType` · `entityId` · `event` (`created` · `edited` ·
`audience_changed` · `agent_use_changed` · `published` · `unpublished` · `verified` ·
`marked_stale` · `promoted` · `restricted_expanded` · `agent_deployed` ·
`agent_used_item`) · `actorId` · `actorType` (`user` · `system`) · `at` ·
`beforeValue` · `afterValue` · `note`.

The company Activity section is a filtered view over it. There is no
`VerificationRecord` table, no `history[]` column, and no per-item counter — see
§ B.11 for why.

**The section-wide visibility control is real.** "Everything here is…" writes
every item in the section into the company draft buffer under the same
`<prefix>-clearance` / `<prefix>-agent-use` keys the per-item sentences bind to,
so a bulk change shows on each item, counts toward Publish, and reverts with
Discard. It was read-only for a while, honestly so: an earlier version held its
own state, changed the sentence, touched no item, and registered no pending
change — the most powerful-looking control on the page, doing nothing.

**Items a human deliberately set are left alone by default** (`isPresetDefault:
false`). That's the whole difficulty of a bulk control: someone moved the
sponsorship answer to Recruiters-only on purpose, and a section-wide "cleared
for candidates" that silently undid it would be the most dangerous click in the
product. They're reported — "3 items kept their own setting" — and including
them is a second, explicit click. When items don't share one clearance the
sentence reads *"Set everything here to…"* rather than claiming a uniformity
that isn't there.

Teams gained an editable per-item sentence for the same reason: a bulk change
writes `team-<id>-clearance`, and a read-only badge that can't move while the
thing it describes does is worse than no badge.

**Publish is a review, and now behaves like one.** Each pending change shows
what the field said and what it will say, word-diffed. It listed field names
before, which cannot be reviewed: *"Sponsorship policy"* is the same label
whether a comma moved or "may be considered" became "will be provided". Inline
when most of the text survived, *was* / *now* blocks below 30% similarity.
Deletions are struck through and muted rather than red — see the vocabulary
below; a diff is data, not an alarm.

## The four kinds of message, and only four

Before this there were five visual treatments for "here is some information", and
**red meant four different things**: a blocking readiness failure, a standing
prohibition, a `restricted` clearance, and an item past its review date. Amber
meant four more. When a permanent rule that cannot be changed shouts as loudly as
a broken agent, the colour stops carrying information and people stop reading
both.

One component — `shared/section-note.tsx` — with kinds separated by **what the
reader can do about it**:

| Kind | Means | Can you act? | Colour |
|---|---|---|---|
| `rule` | Always true here, can't be switched off | **No** — read once | None. Quiet. |
| `attention` | Something needs you; nothing is broken | Yes | Amber |
| `blocking` | An agent can't run, or a candidate hears something wrong | Yes, now | **Red — only here** |
| `empty` | Nothing recorded yet | Optionally | Dashed, muted |

The counter-intuitive one is `rule`. *"The agent may never confirm a figure"*
feels like the most serious thing on the page, so it had the loudest styling —
but it's the system **working**, and there is no action attached to it. Making it
calm is what lets red keep meaning *this is wrong right now*.

**Orientation is not on the list.** *What is this section for* already has a home
in `SectionDef.purpose`, rendered under every section title; a second box
repeating it was the inconsistency this replaced.

**Status is not a message either.** `restricted` is the strictest rung of the
clearance ladder, not a failure — it renders muted with a lock, in the badge, the
visibility sentence, the policy row, the restricted panel, and the activity log.
Stale knowledge is `attention`, not danger: "re-confirm this" is work, not a
broken agent. After this pass red survives in exactly three places — the rail's
blocking gap badge, the `blocked` readiness pill, and the hover state of a
delete affordance.

**Provenance stays in the data but is not rendered as metadata.** The
`VisibilityBlock` still carries `source`, `verifiedBy`, `lastVerifiedAt`,
`nextReviewAt`, and `owner` — the readiness engine needs every one of them to compute
staleness and the unverified-claims queue. What changed is the display: a four-field
strip under every card was answering a question nobody asks constantly. It now
surfaces only as a **warning when something is wrong** (`trust-warning`), with the
detail available in the activity log.

## D.10 KnowledgeGap — **removed; merged into FAQEntry (D.6)**

There is no gap type. A question the agent couldn't answer is not a different
kind of object from one it could — it's a `CompanyQuestion` with no written
answer at any scope, already sitting in the section that will answer it (routed
by `faqSection()`), from the moment a candidate asks.

What the merge deleted, and why:

| Dropped | Why |
|---|---|
| `status` (`open`·`assigned`·`drafted`·`resolved`·`wont_answer`) | Nothing ever advanced it, and it could disagree with the answer field. "Drafted" is what the edit buffer already means; "resolved" is what a filled answer already means. |
| `assignedOwnerId` | Assignment needs a team queue, a notification, and a "mine" filter. There are none. The assignee was always the account owner (already in the header) or the client — and the client isn't an assignee, they're a **wait**, now `askedClientAt`. |
| `proposedLevel` | Asked the consequential question before the answer was written, offering three levels that don't apply in a company workspace. The level is inferred from *where* it gets answered. |
| `sourceQuestion` / `occurrenceCount` / `firstAskedAt` | Already `questionIntent` / `askedCount` / `lastAskedAt` on the entry. |
| `resolvedByFaqEntryId` | The gap **is** the question. Writing an answer resolves it. |

Consequences: nothing "moves back" to a section on resolution (it was never
anywhere else); the Unanswered inbox is a **filter over `company.faq`**, not a
store; and answering from the inbox or from the section is literally the same
edit, because both render the same `QuestionRow` bound to the same draft keys.

**LumaGrid.** *"Is the Central territory an existing book or greenfield?"* —
`faq-lg-15`, `approvedAnswer: ""`, `askedCount: 6`, `category: "why_role_open"`,
and `answerableAt: "job"`, so it renders on the Central AE rather than in any company section.

## D.10b Audiences

`agentCanUse(item, audience)` — `'candidate' | 'internal'`.

| Clearance | Candidate-facing agent | Internal agent |
|---|---|---|
| `cleared_for_candidates` | ✅ | ✅ |
| `recruiters_only` | ❌ | ✅ |
| `restricted` | ❌ | ❌ |

`restricted` bars both — that's the point of a third rung. `agentUse` is
candidate-only by construction (every value describes a candidate conversation),
so an internal bundle ignores it and carries `escalate` items in full.

`compileAgentContext(company, job, audience)` runs one code path through that one
gate. The **"What the agent knows"** panel renders both bundles with a toggle;
flipping it moves the withheld items up into the list, which is the clearest
statement of the ladder available anywhere in the product.

## D.11 AgentReadinessCheck

`id` · `companyId` · `jobId?` · `checkKey` · `scope` (`company` · `job`) ·
`severity` (`critical` · `advisory`) · `status` (`pass` · `caveat` · `fail` · `n_a`) ·
`explanation` · `fixHref` · `evaluatedAt`. Computed, not stored, in this pass.

**LumaGrid.** `checkKey: "work_authorization_policy"`, `status: "caveat"`,
`explanation: "H-1B new-petition policy is unconfirmed. The agent will escalate new-petition
questions instead of answering them."`

## D.12 VisibilityPermission

`id` · `subjectType` (`role` · `profile`) · `subjectRef` · `audience` ·
`canView` · `canEdit` · `canPublish` · `canViewRestricted`.

Defaults: Stellaforce recruiter — view/edit/publish candidate-safe and internal, no
restricted. Stellaforce admin and account owner — all three, including restricted.
Client admin — view candidate-safe and internal for their own client, publish
candidate-safe. Client hiring manager — view candidate-safe, edit their own team's
content. Candidate-facing agent — view candidate-safe published only, no write.

## D.13 InheritanceOverride

`id` · `jobId` · `fieldKey` · `inheritedFromLevel` · `inheritedValue` ·
`overrideValue` · `reason` · `conflictsWithVerified` (boolean) · `createdBy` · `createdAt`.

**LumaGrid.** `fieldKey: "location"`, `inheritedFromLevel: "company"`,
`inheritedValue: "Hybrid — Austin"`, `overrideValue: "Remote, Central US"`,
`conflictsWithVerified: false`.

---

# E. Agent-context assembly rules

## E.1 The compile step

A candidate-facing agent never queries the knowledge base directly. Before deployment,
a **compile step** produces a frozen context bundle. This is deliberate: it makes the
agent's knowledge reviewable in advance, reproducible after the fact, and impossible to
widen accidentally by editing an unrelated internal note.

Compilation, in order:

1. **Filter.** Select only items where `agentCanUse(v)` holds — candidate-safe,
   published, not stale, not escalate-only. Internal and restricted items are excluded
   at this step and never enter the bundle in any form. There is no summarization
   pathway, no "internal context for reasoning only" channel, and no exception.
2. **Layer by precedence.** Role → Team → Department → Company. When the same fact key
   appears at multiple levels, the highest level wins and the lower ones are dropped
   rather than concatenated — an agent given both "Austin hybrid" and "Central US
   remote" will eventually say the wrong one.
3. **Attach FAQ answers.** All qualifying FAQ entries for the job's scope, each with its
   variants, expanded answer, and escalation instructions.
4. **Attach escalation rules.** Every `agentUse: "escalate"` item contributes its topic
   and its escalation instruction, but never its body. The agent learns *that the topic
   requires a handoff*, not what the answer would be.
5. **Attach fallbacks.** Every unknown-valued policy contributes its fixed fallback
   string.
6. **Attach prohibited claims.** The union of all `prohibitedClaims[]` in scope, plus
   the standing global set below, rendered as hard constraints.
7. **Stamp and log.** The bundle records the id and version of every item it contains.

## E.2 Standing prohibitions — always included, never editable

The agent may never:

- Guarantee or imply visa sponsorship, visa eligibility, or any immigration outcome or
  timeline.
- Promise a compensation figure, exception, or negotiation outcome.
- Promise an interview, an offer, or a hiring decision.
- Disclose other candidates, their status, or any comparison between candidates.
- Disclose client commercial terms, contract status, exclusivity, or account health.
- Speculate about layoffs, funding, financial stability, or acquisition beyond published
  candidate-safe content.
- Answer from general world knowledge when company-specific knowledge is absent. Absence
  produces an escalation, not an inference.

## E.3 Unknowns

When a critical question has unknown or unverified information, the agent escalates:

> "I don't have a confirmed answer for this role. I can flag this for the recruiting
> team to verify."

It then records an **unanswered `CompanyQuestion`** — same type as an answered one,
no written answer at any scope — in the section its category routes to, where it surfaces both in
place and in the Unanswered inbox with its `askedCount`. Candidate questions are the
primary discovery mechanism for what the profile is missing; unanswered questions are a
feature of the loop, not an error log.

## E.4 Recruiter visibility

The Publish dialog shows the compiled bundle grouped by source level, with counts of
excluded recruiters-only and restricted items — counts only. After each
candidate interaction, an `agent_used_item` event records which knowledge items the
agent drew on, so a recruiter reviewing a screen can trace any statement back to an
approved, verified source and to the person who owns it. That trace is the one thing
that genuinely needs a log; it is a property of the interaction, not of the item.

---

# F. UX copy

## F.1 Visibility labels

| Label | Helper text |
|---|---|
| **Cleared for candidates** | The agent can use this in candidate conversations. (`cleared_for_candidates`) |
| **Recruiters only** | Stays inside your team. The agent never receives it. (`recruiters_only`) |
| **Restricted — named staff only** | Never leaves your team, never reaches an agent. (`restricted`) |
| **the agent brings it up** | Volunteered without being asked. (`proactive`) |
| **the agent answers only if asked** | Used only on request. (`on_request`) |
| **the agent uses it silently, never quotes it** | Reasoning only. (`reference_only`) |
| **the agent always hands it to you** | Escalates instead of answering. (`escalate`) |

## F.2 Status labels

**Verified** · **Needs review** · **Unverified** · **Stale** · **Unknown** ·
**Draft** · **In review** · **Published** · **Ready to deploy** · **Ready with
caveats** · **Recruiter review required** · **Blocked**

## F.3 Empty states

- **No companies** — "No companies yet. Add your first company after a client intake
  call — a name and an industry are enough to start."
- **New company overview** — "This company was created from an intake call and has
  almost no knowledge yet. Candidate agents are blocked until the essentials are
  confirmed."
- **No departments** — "No departments yet — that's fine. Company-level knowledge
  covers most roles. Create a department when a job needs context this company profile
  can't provide."
- **No teams** — "No teams in this department yet. Add one when a role needs a hiring
  manager, a day-in-the-life, or team-specific answers."
- **No content in a section** — "Nothing approved for candidates yet. Until something
  is published here, agents will escalate every question on this topic."
- **No jobs** — "Everything on this company profile is reused by every job you create
  here — you won't re-enter any of it."
- **Policy never entered** — "Nothing entered yet, so the agent has nothing to say
  here. 'Not entered' and 'not offered' are different answers — set the value either
  way."
- **No FAQ** — "No approved answers yet. Candidate agents will escalate every question
  until at least the essentials are answered."
- **No internal brief** — "No internal brief yet. This is where account strategy,
  hiring-manager preferences, and search constraints live — none of it reaches
  candidates."
- **No gaps** — "No unanswered questions. Anything a candidate asks that approved
  knowledge can't cover will appear here."
- **No activity** — "No changes recorded yet. Edits, verifications, and agent
  deployments land here."

## F.4 Warnings

- **Blocked deployment** — "Blocked: this company has no confirmed work-authorization
  policy. Candidate agents may not answer sponsorship questions without a verified
  policy or an approved fallback."
- **Stale** — "Last verified 8 months ago. Re-confirm before using this in candidate
  conversations."
- **Unapproved** — "This answer is not approved for candidate conversations."
- **Unknown visa policy** — "No confirmed visa policy is available for this role.
  Candidates asking about sponsorship will be routed to you."
- **Publishing internal content** — "This block is internal only. Change its audience
  to Candidate-safe before publishing."
- **Bulk overwrite** — "3 items in this section have their own visibility settings.
  Keep them, or overwrite with the section setting?"
- **Conflicting override** — "This role's location conflicts with the company's
  verified location policy. Confirm which one candidates should hear."
- **Restricted expansion** — "Opening a restricted note is recorded in the audit log."
- **Deleting a used department** — "Go-to-Market has 1 active job. Move it to
  company level, or reassign it before deleting."

## F.5 Calls to action

`Add company` · `Create job` · `Publish` ·
`Promote to candidate-safe draft` · `Mark verified` · `Re-verify` · `Publish` ·
`Unpublish` · `Set all in this section to…` · `Create department` · `Create team` ·
`Assign an owner` · `Draft an answer` · `Won't answer` · `Add a question` ·
`Add phrasing` · `Add location` · `View history` · `Revert to inherited value` ·
`Discard` · `Publish N changes` · `Keep editing` · `Version history` · `Save and finish later` · `Sections` (mobile rail trigger)

Publish review: **"Screening agents pick these up immediately. Anything still marked
unconfirmed stays flagged until someone verifies it."**
Version history, unpublished company: **"Never published. Nothing here has reached an
agent yet."**

Visibility sentences, which replaced the badge pair. The heading over the first
clause is **"How far this travels"**:
`Cleared for candidates` · `Recruiters only` · `Restricted — named staff only` ·
`the agent brings it up` · `the agent answers only if asked` · `the agent uses it
silently, never quotes it` · `the agent always hands it to you` · `— the agent never
receives it`

Short forms, for badges and dense rows: `Cleared` · `Recruiters only` · `Restricted`

Deploy-agent dialog headings, which double as the disclosure explanation:
`What the agent will know` · `What it knows` · `Policies it can state` · `Questions it
can answer` · `Topics it hands back to you` · `What it will never say` · `N items
withheld`

## F.6 Tone

Say what will happen, in the candidate's or recruiter's terms, and never in
compliance-speak. "Candidates asking about sponsorship will be routed to you" beats
"policy verification required." Warnings state the consequence and offer the fix in the
same breath. Nothing scolds, because an incomplete profile after an intake call is the
normal state of the world, not a mistake.
