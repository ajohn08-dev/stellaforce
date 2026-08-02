# Stella Force — Home Page

Record of what the `/home` route shows, per profile, and why. Cross-ref with
[CLAUDE.md](CLAUDE.md) (routes, stack conventions) and
[DB_Schema.md](DB_Schema.md) (`profiles.side` / `profiles.role` /
`profiles.client_role`).

`/home` is **role-gated** (`src/app/(app)/home/page.tsx`, via
`getCurrentProfile()` in `src/lib/auth.ts`), four ways:

- **Stellaforce-side recruiters** (`side = 'stellaforce'`, `role =
  'recruiter'`) get **`RecruiterHome`** — the mission-control layout
  documented in [Recruiter](#recruiter-recruiterhome) below.
- **Stellaforce-side internal admins** (`side = 'stellaforce'`, `role =
  'admin'`) get **`InternalAdminHome`** — the operations-command-center
  layout documented in
  [Internal Admin](#internal-admin-internaladminhome) below. Most internal
  admins are also active recruiters, so this view deliberately blends
  individual-contributor content (the admin's own reqs/actions) with
  oversight content (recruiters/clients/platform).
- **Client-side admins** (`side = 'client'`, `client_role = 'admin'`) get
  **`ClientAdminHome`** — the oversight-console layout documented in
  [Client Admin](#client-admin-clientadminhome) below.
- **Every other profile** — Stellaforce managers, client-side
  member/hiring_manager/recruiter roles — get `GenericHomeOverview`
  (`src/components/home/generic-home-overview.tsx`): the original simple
  candidate/job/client counts view. It has no widgets of its own to document.
  If a mission-control view is designed for one of these roles later,
  document it here as its own section, following the same pattern.

**Status:** All three mission-control views are UI only — every widget runs
on static mock data, there is no backend/data pipeline behind any of it yet
(see CLAUDE.md's build order).

All three personas share the same shell mechanics, established by the
recruiter view first and reused as-is by the other two:
- Page container: `h-[calc(100vh-3.5rem)] overflow-hidden flex flex-col
  gap-4 p-4` — the whole page fits the viewport under the app header with no
  page-level scroll.
- Toolbar row (`shrink-0`): a persona-specific **Filter** button + the shared
  **`HomeDateRangePicker`** (`src/components/home/home-date-range-picker.tsx`
  — a true calendar-grid `Popover` + `Calendar`, reused unchanged by all three).
- Widget grid (`shrink-0`, fixed `lg:h-[497px]`): 3-zone layout, `lg:items-stretch`
  + `grid-rows-2` side columns (see [Page structure](#page-structure) below).
- Chat panel (`min-h-0 flex-1`): the shared **`HomeChatPanel`**
  (`src/components/home/home-chat-panel.tsx`) fills whatever vertical space
  remains, reused unchanged by all three — only the `prompts` array differs.

---

## Recruiter (`RecruiterHome`)

**File:** `src/components/home/recruiter-home.tsx`. Mock data:
`src/lib/mock-home.ts`. Widget components live flat under
`src/components/home/`.

### Product framing

Stella Force is an AI-native recruiting platform; the internal recruiter is
its primary power user. The recruiter home page is their **workbench /
mission control** — not a generic analytics dashboard. Its job is to answer,
in under 3 seconds: what moved, what needs action today, what's at risk, how
covered their reqs are, and whether the AI agents are operating reliably.

Design rules that shaped every widget below:
- Action-centric, not report-centric.
- Strong visual hierarchy — the recruiter should know what matters immediately.
- Each section answers a different question (clear information scent);
  no overlap between widgets.
- Clean, modern, operational — not a wall of problems, not dashboard sprawl.
- Modular cards, but each one semantically distinct (not identical stat tiles).
- Avoid generic analytics labels (e.g. "Open Jobs", "Qualified Candidates",
  "Stage Distribution") unless reframed into recruiter-native concepts.
- Whitespace and grouping over charts; color used sparingly and functionally
  (positive / warning / neutral).
- Everything visible above the fold, no dashboard sprawl.

**Emotional flow:** progress first, then action, then risk, then supporting
diagnostics. Momentum (positive) leads before Risks (serious) so the page
never opens on a wall of problems.

### Page structure

1. **Left rail** — small contextual summary widgets: Momentum, Risks.
2. **Center** — the main work surface: Today's Focus (dominant, biggest widget).
3. **Right rail** — compact diagnostic/system widgets: Bench Strength, Agent Health.
4. **Below, full width** — Chat drilldown (suggested prompts + input), a
   secondary surface that doesn't compete with the widgets above it.

The toolbar's Filter button is `src/components/home/home-filter-button.tsx`
(same `DropdownMenu` + outline `Button` + `Filter` icon pattern used on
`/jobs` and `/candidates`; fields: Client, Req).

**Widget hierarchy:** Today's Focus is the biggest, most prominent widget.
Momentum and Risks are smaller scan widgets on the left; Bench Strength and
Agent Health are compact secondary widgets on the right. All four side
widgets are sized equal to each other, and together (as a stacked pair) equal
Today's Focus's height — enforced via `lg:items-stretch` on the row plus
`grid-rows-2` on each side column. Each card scrolls its own content
internally (`overflow-y-auto` + the `.no-scrollbar` utility) rather than
growing the layout if content overflows its fixed share of the height.

### Widgets

#### 1. Momentum
**File:** `src/components/home/momentum-card.tsx`

**Purpose:** Show what moved forward during the selected time period. Creates
a positive, motivating top-level signal before the recruiter sees risks.

**Content:**
- Candidates advanced to next stage
- Interviews booked / completed
- Feedback submitted within SLA
- Reqs moved from at-risk to on-track
- Successful agent-assisted completions
- Small trend note compared to previous period

**Feel:** Positive, concise, celebratory but not cheesy. Summary-oriented,
not another task list.

**Content pattern:** One hero summary → 3–4 supporting proof points →
optional trend delta.

**Example copy:**
- "14 candidates advanced this week"
- "9 interviews booked, 7 completed"
- "2 reqs moved from at-risk to on-track"
- "11 automations completed successfully"
- "Up 18% vs last week"

#### 2. Today's Focus
**File:** `src/components/home/todays-focus-card.tsx`

**Purpose:** Show the highest-impact actions the recruiter should take today.
This is the main work surface.

**Content:**
- Ranked list of the top recruiter-owned actions
- Approvals, follow-ups, shortlist review, scheduling fixes, nudges, offer actions
- Each item carries context: candidate / req / client
- Each item has a clear CTA
- Prioritized by impact on speed, SLA, or candidate progression

**Feel:** Operational, clear, focused — a command center, not a summary panel.

**Content pattern:** 3–5 prioritized rows. Each row: primary action text,
secondary context line, CTA aligned right. CTA label varies by action type
(Review / Nudge / Resolve / Approve / Schedule); the top-ranked row's CTA is
solid (`variant="default"`), the rest are `outline`, to reinforce priority
order without every row shouting equally.

**Example copy:**
- "Follow up with Priya Desai — awaiting availability for onsite" → **Nudge**
- "Review 3 shortlisted candidates" → **Review**
- "Resolve 1 final-round scheduling conflict for Karan Ahuja" → **Resolve**
- "Approve 1 offer draft for Backend Engineer" → **Approve**

#### 3. Risks
**File:** `src/components/home/risks-card.tsx`

**Purpose:** Surface items that may slip, breach SLA, or need immediate
escalation. Distinct from Today's Focus: this is exception/blocker
visibility, not owned action items.

**Content:**
- SLA breaches, near-breach items
- Stalled candidates
- Offer delays, feedback delays
- Blocked by HM / interviewer / candidate / client
- No-movement / aging warnings

**Feel:** Triage-oriented. Serious but not overwhelming.

**Content pattern:** A single flat list of individual line items (no
subcategory subheadings in the current build — grouping is conveyed only via
each row's icon, disclosed on hover through a tooltip: "Breaching today" /
"Blocked by others" / "Stalled in stage"). Warning color used sparingly (the
header count badge + the small per-row icon), not a chaotic red list.

**Example copy:**
- "1 offer decision overdue" (Breaching today)
- "2 interviews blocked by interviewer availability" (Blocked by others)
- "4 candidates are stalled in HM review" (Stalled in stage)
- "3 candidates nearing feedback SLA breach" (Stalled in stage)

#### 4. Bench Strength
**File:** `src/components/home/bench-strength-card.tsx`

**Purpose:** Show how covered the recruiter's open reqs are. Portfolio
coverage, not generic pipeline counts.

**Content:**
- Req coverage status
- Number of viable / interview-ready candidates by req
- Coverage labels: Strong, Adequate, Thin, Empty
  (`BENCH_COVERAGE_BADGE_CLASS` in `src/lib/constants.ts`)
- A stage filter ("All Stages" dropdown) in the header
- A summary portfolio-coverage percentage as the hero number

**Feel:** Diagnostic, compact, easy to scan — more interpretive than analytical.

**Content pattern:** Hero portfolio coverage percentage, then up to 6 req
rows: req name + client/account on the left, `filled/total` fraction + a
coverage badge on the right.

**Example copy:**
- "95% portfolio coverage"
- "Product Designer — 4/10 — Adequate"
- "Senior PM — 7/10 — Strong"
- "ML Engineer — 1/10 — Thin"

#### 5. Agent Health
**File:** `src/components/home/agent-health-card.tsx`

**Purpose:** Show whether the AI agents are operating reliably and where
automation quality may need attention. System trust/reliability, not a
task-completion list.

**Content:**
- Automation success rate
- Tasks handled autonomously
- Exception rate / manual override rate
- Top failure cause (degradation note)
- An agent filter ("All Agents" dropdown) in the header

**Feel:** Compact, trustworthy, system-level — diagnostic rather than noisy.

**Content pattern:** Hero reliability percentage, then 2–4 supporting metric
rows, then a small low-key note only if performance degraded (not an alert box).

**Example copy:**
- "95% automation reliability"
- "24 tasks handled automatically"
- "3 exceptions need review"
- "Manual override rate 8%"
- "Calendar sync failures affected 2 runs"

#### 6. Chat drilldown
**File:** `src/components/home/home-chat-panel.tsx` (shared with Client Admin)

**Purpose:** Placeholder for future natural-language drilldown into any of
the widgets above. No backend yet — sending is a no-op.

**Content:**
- 3 suggested prompts (single line, horizontally scrollable if they overflow
  rather than wrapping)
- A text input area

**Example prompts:**
- "Which reqs are thin right now?"
- "What is driving HM review delays?"
- "Show all candidates at risk of SLA breach today"

**Feel:** Sits below the main cards as a drilldown/ask interface — it must
not compete with the primary workflow above it. No card chrome (no border,
no background) on the outer panel; the text field itself carries a white
background + border so it reads as the one interactive control in an
otherwise plain area.

### Mock data

`src/lib/mock-home.ts`: `MOCK_MOMENTUM`, `MOCK_TODAYS_FOCUS`, `MOCK_RISKS`,
`MOCK_BENCH_STRENGTH`, `MOCK_AGENT_HEALTH`, `SUGGESTED_PROMPTS`. When a real
data pipeline is designed for any widget, replace the corresponding mock
export and the prop it feeds — the widget components themselves are already
shaped around these typed props and shouldn't need to change.

---

## Client Admin (`ClientAdminHome`)

**File:** `src/components/home/client-admin/client-admin-home.tsx`. Mock
data: `src/lib/mock-client-home.ts`. Widget components live under
`src/components/home/client-admin/`.

### Product framing

The client-side HR admin / client admin is not living in recruiter-level
execution — they need **oversight**: what's moving, what needs their
decision, where their own organization is causing delay, how well their open
reqs are covered, and how the hiring program is performing overall. This
page is their **live oversight console**, not a recruiter task board and not
a generic BI dashboard.

Design rules (same spirit as the recruiter view, reframed for an oversight
persona):
- Action-centric and oversight-oriented — approvals and accountability over
  low-level operational metrics.
- Strong visual hierarchy — the user should know what matters in under 3
  seconds.
- Each section answers a distinct question; no overlap between widgets.
- Client/admin-friendly language — avoid recruiter or candidate-ops
  terminology (no "candidates advanced", "stages", "screening") unless
  unavoidable.
- Lists, counts, statuses, and health indicators over charts.
- Color used sparingly and functionally (positive / warning / neutral).
- Everything visible above the fold, no dashboard sprawl.

**Emotional flow:** progress first, then pending decisions, then
delay/accountability, then supporting strategic diagnostics. Avoid making the
page feel like a wall of escalations.

### Page structure

Structurally identical to the recruiter view (same shell, same
`lg:items-stretch` + `grid-rows-2` equal-height mechanism), different widgets:

1. **Left rail** — Momentum, Risks & Accountability.
2. **Center** — Today's Focus (dominant, biggest widget) — here, a decision
   / approval queue rather than a recruiter task queue.
3. **Right rail** — Coverage, Hiring Performance.
4. **Below, full width** — Chat drilldown, shared component with the
   recruiter view.

The toolbar's Filter button is
`src/components/home/client-admin/client-home-filter-button.tsx` — same
`DropdownMenu` + outline `Button` + `Filter` icon pattern as the recruiter
view's, but with **Department** and **Priority** fields instead of
Client/Req (a client admin already belongs to a single client, so filtering
by client doesn't apply here). The date-range picker is the exact same
shared `HomeDateRangePicker` used by the recruiter view.

### Widgets

#### 1. Momentum
**File:** `src/components/home/client-admin/client-momentum-card.tsx`
(same component shape as the recruiter `MomentumCard`)

**Purpose:** Show what moved forward during the selected period. Creates
confidence and positive context before showing issues or delays —
communicates visible progress and vendor value.

**Content:**
- Roles moved into active hiring
- Candidates advanced to interview / final stages
- Offers sent
- Roles filled
- Reqs moved from delayed to on-track
- Improvement in responsiveness or SLA compliance
- Positive trend vs previous period

**Feel:** Positive, concise, executive-friendly. Summary-oriented, not a task list.

**Content pattern:** One hero summary → 3–4 supporting proof points →
optional trend delta.

**Example copy:**
- "3 roles moved to finalist stage this week"
- "2 offers sent"
- "1 priority req filled"
- "4 reqs stayed on track this period"
- "Hiring manager turnaround improved 15% vs last week"

#### 2. Today's Focus
**File:** `src/components/home/client-admin/client-todays-focus-card.tsx`
(same component shape as the recruiter `TodaysFocusCard`)

**Purpose:** Show the highest-impact decisions or approvals the client admin
should take today. The main work surface — a governance/approval center,
not a recruiter queue.

**Scope note:** Stella Force only picks up *after* a req is already approved
and live on the platform — req approval, budget/comp sign-off, and headcount
confirmation happen upstream, before the req ever reaches Stella Force, so
none of that belongs here. Everything in this widget is a post-approval,
in-platform action:

**Content:**
- Offer approvals
- Escalations on unresponsive stakeholders (hiring manager, interviewer)
- Nudges to unblock a stalled active req
- Candidate-quality calls surfaced during active hiring (e.g. low match
  quality flagged for a role)
- Interview panel change approvals

**Feel:** Clear, decision-oriented, high leverage.

**Content pattern:** 3–5 prioritized rows. Each row: primary decision/action
text, secondary context line (role / team / account), CTA aligned right. CTA
label varies by action type (Approve / Escalate / Review / Nudge); the
top-ranked row's CTA is solid, the rest outline — same priority convention
as the recruiter view.

**Example copy:**
- "Approve offer package for Senior Backend Engineer" → **Approve**
- "Escalate non-response from hiring manager on 2 priority roles" → **Escalate**
- "Review 3 candidates flagged as low match quality for Product Designer" → **Review**
- "Nudge hiring manager for overdue feedback on Data Analyst interviews" → **Nudge**
- "Approve interview panel change for Customer Success Manager" → **Approve**

#### 3. Risks & Accountability
**File:** `src/components/home/client-admin/risks-accountability-card.tsx`

**Purpose:** Show what is delayed, what is at risk, and — the key
difference from the recruiter view's Risks widget — **who owns the delay**.
Root-cause- and accountability-oriented, not just a "what's late" list.

**Content:**
- Reqs delayed beyond SLA
- Candidates stalled in stage
- Hiring manager response delays
- Interview scheduling delays
- Offer approval delays
- Internal bottlenecks
- Delay owner attribution: recruiter, hiring manager, interviewer, client
  admin, or candidate
- Aging / no-movement warnings

**Feel:** Serious, structured, actionable — useful for escalation and
internal accountability, not just a chaotic red list.

**Content pattern:** Same flat-list-with-hover-tooltip mechanism as the
recruiter Risks widget (icon per row discloses its category on hover:
"Breaching today" / "Blocked by hiring manager" / "Pending internal
approval" / "No movement / aging"), **plus** an explicit owner `Badge`
(`variant="outline"`) at the right edge of every row — this is the one
structural addition over the recruiter Risks widget, since accountability
must be visible, not just implied by icon.

**Example copy:**
- "1 offer decision overdue" — Senior Backend Engineer · Naehas — **Client Admin**
- "3 reqs delayed — blocked by hiring manager feedback" — Engineering, Design, Data — **Hiring Manager**
- "Scheduling delays concentrated in Marketing interviews" — Marketing — **Hiring Manager**
- "2 offers pending internal approval" — Senior Backend Engineer, Product Designer — **Client Admin**
- "1 req has had no movement in 8 days" — Data Analyst · Naehas — **Recruiter**

#### 4. Coverage
**File:** `src/components/home/client-admin/coverage-card.tsx` (client-admin
analog of the recruiter `BenchStrengthCard` — same shape, reuses
`BENCH_COVERAGE_BADGE_CLASS` from `src/lib/constants.ts` for the Strong /
Adequate / Thin / Empty labels)

**Purpose:** Show how well open reqs are covered with viable candidates —
the client-facing version of bench strength. Answers: are the most important
reqs sufficiently covered?

**Content:**
- Coverage health by req
- Strong / adequate / thin / empty coverage labels
- Number of interview-ready / finalist-ready candidates
- Priority req coverage
- Roles with weak bench
- Reqs aging with insufficient coverage

**Feel:** Compact, strategic, easy to scan — more interpretive than detailed.

**Content pattern:** Hero priority-coverage percentage, then up to 6 req
rows: req name + department/team on the left, finalist-ready-count/target
fraction + a coverage badge on the right. A "Priority Only" filter
("All Reqs" dropdown) sits in the header, mirroring Bench Strength's stage filter.

**Example copy:**
- "78% priority req coverage"
- "Senior PM — 4/5 — Strong"
- "Product Designer — 2/5 — Adequate"
- "ML Engineer — 1/5 — Thin"
- "Finance Analyst — 0/5 — Empty"

#### 5. Hiring Performance
**File:** `src/components/home/client-admin/hiring-performance-card.tsx`
(client-admin analog of the recruiter `AgentHealthCard` — same shape: hero
percentage, metric rows, optional insight note)

**Purpose:** Show strategic performance of the hiring program — an
executive summary, not a full BI reporting module. Useful for weekly hiring
reviews and leadership discussions.

**Content:**
- Time to fill / time to hire
- Stage conversion / funnel health
- Hiring manager responsiveness
- Offer approval cycle time
- Offer acceptance rate
- SLA compliance trend

**Feel:** Executive summary of program health — compact and confidence-building.

**Content pattern:** Hero SLA-compliance percentage, then 2–4 supporting
metric rows, then a small low-key insight note only when relevant (e.g. a
decline vs. last period) — same "diagnostic, not noisy" treatment as Agent
Health's degradation note.

**Example copy:**
- "89% SLA compliance"
- "Avg time to fill — 38 days"
- "Offer approval cycle time — 2.1 days"
- "Hiring manager response time — 1.8 days"
- "Interview-to-offer conversion — 24%"
- "SLA compliance down 4 pts vs last period"

#### 6. Chat drilldown
**File:** `src/components/home/home-chat-panel.tsx` (shared, unchanged
component — only the `prompts` array differs from the recruiter view)

**Purpose:** Placeholder for future natural-language drilldown, scoped to
this persona's oversight questions. No backend yet — sending is a no-op.

**Example prompts:**
- "Which reqs are delayed because of hiring manager feedback?"
- "Show all roles awaiting internal approval"
- "Which business units have the slowest response times?"

### Mock data

`src/lib/mock-client-home.ts`: `MOCK_CLIENT_MOMENTUM`,
`MOCK_CLIENT_TODAYS_FOCUS`, `MOCK_RISKS_ACCOUNTABILITY`, `MOCK_COVERAGE`,
`MOCK_HIRING_PERFORMANCE`, `CLIENT_SUGGESTED_PROMPTS`. Shapes intentionally
mirror `mock-home.ts` so all three personas' widgets stay structurally
consistent even as content diverges. When a real data pipeline is designed
for any widget, replace the corresponding mock export and the prop it feeds.

---

## Internal Admin (`InternalAdminHome`)

**File:** `src/components/home/internal-admin/internal-admin-home.tsx`. Mock
data: `src/lib/mock-internal-admin-home.ts`. Widget components live under
`src/components/home/internal-admin/`.

### Product framing

The internal admin is a hybrid persona — most are also active recruiters, so
they operate in two modes at once: **individual contributor** (their own
jobs, candidates, recruiter actions, escalations) and **oversight**
(recruiter/team/client health, SLAs, platform reliability, permissions,
integrations, automation quality). This page is their **operations command
center** — not just a recruiter task board, and not just a system settings
console.

Design rules (same spirit as the other two views, reframed for a hybrid
admin/recruiter persona):
- Action-centric and oversight-oriented — prioritize intervention and
  supervision over passive analytics.
- Strong visual hierarchy — the user should know what matters in under 3 seconds.
- Each section answers a distinct question; no overlap between widgets.
- Admin-friendly and operations-friendly language — this should not read
  like a generic analytics dashboard or a settings page.
- Lists, counts, statuses, and health indicators over charts.
- Color used sparingly and functionally (positive / warning / neutral).
- Everything visible above the fold, no dashboard sprawl.

**Emotional flow:** progress first, then high-impact actions, then
risks/accountability, then system and team/client oversight. Avoid making
the page feel like a wall of issues.

### Page structure

Structurally identical to the recruiter and client-admin views (same shell,
same `lg:items-stretch` + `grid-rows-2` equal-height mechanism), different widgets:

1. **Left rail** — Momentum, Risks & Accountability.
2. **Center** — Today's Focus (dominant, biggest widget) — a combined
   personal-recruiting + platform-intervention queue.
3. **Right rail** — Platform Health, Team & Client Performance.
4. **Below, full width** — Chat drilldown, shared component with the other
   two views.

The toolbar's Filter button is
`src/components/home/internal-admin/internal-admin-filter-button.tsx` — same
`DropdownMenu` + outline `Button` + `Filter` icon pattern as the other two
views', but with **Recruiter** and **Client** fields (unlike the client-admin
view, an internal admin oversees multiple recruiters and multiple clients,
so both are filterable dimensions here). The date-range picker is the same
shared `HomeDateRangePicker` used everywhere else.

### Widgets

#### 1. Momentum
**File:** `src/components/home/internal-admin/internal-admin-momentum-card.tsx`
(same component shape as the recruiter `MomentumCard`)

**Purpose:** Show what moved forward — across both the admin's own work and
the broader platform/team context — during the selected period. Creates
confidence before showing delays or issues.

**Content:**
- Candidates advanced
- Interviews completed
- Offers sent
- Reqs moved from at-risk to on-track
- Team/client wins
- Improved SLA compliance
- Successful automation/agent wins
- Positive trend vs previous period

**Feel:** Positive, concise, motivating but not cheesy. Reflects both
personal recruiting and platform/team momentum.

**Content pattern:** One hero summary → 3–4 supporting proof points →
optional trend delta.

**Example copy:**
- "18 candidates advanced this week"
- "6 interviews completed across your reqs"
- "3 client reqs moved back on track"
- "Scheduling agent resolved 24 bookings without admin intervention"
- "SLA compliance improved 6 pts this week"

#### 2. Today's Focus
**File:** `src/components/home/internal-admin/internal-admin-todays-focus-card.tsx`
(same component shape as the recruiter `TodaysFocusCard`)

**Purpose:** Show the highest-impact actions the internal admin should take
today, across both recruiting operations and platform/admin oversight. The
main work surface — a command center for deciding where to step in today.

**Content:**
- Personal recruiter actions on priority reqs
- Escalations requiring admin action
- Recruiter backlog review
- Req reassignments
- User access / permission approvals
- Integration or workflow issues affecting active recruiting work
- Client-level issues requiring intervention
- Decisions about ownership, routing, or corrective action

**Feel:** Operational, intervention-oriented, high leverage.

**Content pattern:** 3–5 prioritized rows. Each row: primary action text,
secondary context line (req / recruiter / client / workflow), CTA aligned
right. CTA label varies by action type (Escalate / Review / Resolve /
Reassign / Approve); the top-ranked row's CTA is solid, the rest outline —
same priority convention as the other two views.

**Example copy:**
- "Escalate 2 hiring manager feedback breaches on Zenarate roles" → **Escalate**
- "Review 3 recruiter backlogs with stalled reqs" → **Review**
- "Resolve calendar sync failures affecting final-round scheduling" → **Resolve**
- "Reassign Product Designer req to a recruiter with capacity" → **Reassign**
- "Grant client admin access for Acme hiring team" → **Approve**

#### 3. Risks & Accountability
**File:** `src/components/home/internal-admin/admin-risks-accountability-card.tsx`

**Purpose:** Show what is delayed, at risk, overloaded, or broken across
recruiters, clients, and workflows — and who owns the issue. Root-cause- and
accountability-oriented, built for triage and intervention, not just reporting.

**Content:**
- SLA breaches by recruiter / team / client
- Reqs with no movement
- Hiring manager delays
- Recruiter backlog / overloaded owners
- Candidate-stage aging
- Offer / scheduling bottlenecks
- Delay owner attribution: recruiter, hiring manager, client admin,
  interviewer, or **system** (the one owner type unique to this persona —
  platform/integration-caused delays)
- Workflow issues already affecting live hiring operations

**Feel:** Serious, structured, root-cause oriented.

**Content pattern:** Same flat-list-with-hover-tooltip mechanism as the other
two Risks widgets (icon per row discloses its category on hover: "Breaching
today" / "Blocked by hiring manager" / "Recruiter overload" /
"System-caused delays"), plus an explicit owner `Badge` (`variant="outline"`)
at the right edge of every row.

**Example copy:**
- "3 reqs breached SLA today" — Zenarate, Naehas — **Hiring Manager**
- "4 reqs delayed — awaiting hiring manager feedback" — Zenarate, Naehas — **Hiring Manager**
- "2 recruiters have overloaded backlogs" — Priya Desai, Sam Okafor — **Recruiter**
- "Calendar integration issues blocked 5 interviews" — Platform-wide — **System**
- "3 client accounts show rising scheduling delays" — Acme, Zenarate, Naehas — **System**

#### 4. Platform Health
**File:** `src/components/home/internal-admin/platform-health-card.tsx`
(same component shape as the recruiter `AgentHealthCard` — hero percentage,
metric rows, optional degradation note)

**Purpose:** Show whether the platform, integrations, and automations are
functioning reliably across clients and recruiters — the system/governance
health view unique to this persona. Useful for catching environment issues
before they become recruiting failures.

**Content:**
- Integration health (calendar, email, ATS sync, background systems)
- Automation success rate
- Agent exception rate
- Failed workflows
- User access / permission issues
- Missing configuration or mapping issues
- Sync lag or delivery problems
- Affected recruiters or client orgs

**Feel:** Compact, trustworthy, system-level — diagnostic rather than noisy.

**Content pattern:** Hero platform-reliability percentage, then 2–4
supporting metrics, then a small low-key note only if performance degraded.
A system filter ("All Systems" dropdown: Calendar / Email / ATS Sync) sits
in the header, mirroring Agent Health's agent filter.

**Example copy:**
- "96% automation success rate"
- "2 client orgs affected by calendar sync lag"
- "5 workflow exceptions need admin review"
- "3 users blocked by missing permissions"
- "Email delivery dipped 4% vs last week"

#### 5. Team & Client Performance
**File:** `src/components/home/internal-admin/team-client-performance-card.tsx`
(same component shape as the recruiter `BenchStrengthCard` / client-admin
`CoverageCard` — hero percentage + up to 6 rows; uses a new
`TEAM_PERFORMANCE_BADGE_CLASS` map in `src/lib/constants.ts` for the On
Target / Needs Attention / Overloaded status labels, following the same
pattern as `BENCH_COVERAGE_BADGE_CLASS`)

**Purpose:** Show how recruiters and client portfolios are performing
overall — the supervision and management view. Focused on coaching,
balancing, and intervention, more interpretive than analytical.

**Content:**
- SLA compliance by recruiter/team/client
- Open reqs by recruiter
- Recruiter workload / active req load
- Time to fill by recruiter or client
- Performance outliers
- Client portfolio health
- Roles filled by recruiter/team
- Accounts or recruiters needing coaching or rebalancing

**Feel:** Compact leadership summary.

**Content pattern:** Hero team-SLA-compliance percentage, then up to 6 rows
(a small outliers/attention-areas list): recruiter or client name + context
on the left, a metric value + a status badge (On Target / Needs Attention /
Overloaded) on the right. A scope filter ("All" dropdown: Recruiters /
Clients) sits in the header.

**Example copy:**
- "91% team SLA compliance"
- "Priya Desai — Recruiter · Engineering — 5.2 days avg — Needs Attention"
- "Sam Okafor — Recruiter · Design — 14 active reqs — Overloaded"
- "Acme — Client portfolio — 32% delay rate — Needs Attention"
- "East Region — Avg time to fill — 34 days — On Target"

#### 6. Chat drilldown
**File:** `src/components/home/home-chat-panel.tsx` (shared, unchanged
component — only the `prompts` array differs)

**Purpose:** Placeholder for future natural-language drilldown, scoped to
intervention, team health, and system diagnosis. No backend yet — sending
is a no-op.

**Example prompts:**
- "Which recruiters have the most SLA breaches this week?"
- "Show clients affected by sync failures"
- "Which reqs are stalled because of hiring manager response time?"

### Mock data

`src/lib/mock-internal-admin-home.ts`: `MOCK_INTERNAL_ADMIN_MOMENTUM`,
`MOCK_INTERNAL_ADMIN_TODAYS_FOCUS`, `MOCK_ADMIN_RISKS_ACCOUNTABILITY`,
`MOCK_PLATFORM_HEALTH`, `MOCK_TEAM_CLIENT_PERFORMANCE`,
`INTERNAL_ADMIN_SUGGESTED_PROMPTS`. Shapes intentionally mirror
`mock-home.ts` and `mock-client-home.ts` so all three personas' widgets stay
structurally consistent even as content diverges. When a real data pipeline
is designed for any widget, replace the corresponding mock export and the
prop it feeds.
