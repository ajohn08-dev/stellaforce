# Stella Force — Home Page

Record of what the `/home` route shows, per profile, and why. Cross-ref with
[CLAUDE.md](CLAUDE.md) (routes, stack conventions) and
[DB_Schema.md](DB_Schema.md) (`profiles.side` / `profiles.role`).

`/home` is **role-gated** (`src/app/(app)/home/page.tsx`, via
`getCurrentProfile()` in `src/lib/auth.ts`):

- **Stellaforce-side recruiters** (`side = 'stellaforce'`, `role =
  'recruiter'`) get the **recruiter mission control** layout documented below.
- **Every other profile** — Stellaforce managers/admins, all client-side
  roles — get `GenericHomeOverview`
  (`src/components/home/generic-home-overview.tsx`): the original simple
  candidate/job/client counts view. It has no widgets of its own to document;
  this file is only about the recruiter view. If a manager/admin- or
  client-facing mission-control view is designed later, document it here as
  its own section.

**Status:** UI only. Every widget below runs on static mock data
(`src/lib/mock-home.ts`) — there is no backend/data pipeline behind any of
it yet (see CLAUDE.md's build order). Component files live under
`src/components/home/`.

---

## Product framing

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

---

## Page structure

Three-zone desktop layout (`src/app/(app)/home/page.tsx`):

1. **Left rail** — small contextual summary widgets: Momentum, Risks.
2. **Center** — the main work surface: Today's Focus (dominant, biggest widget).
3. **Right rail** — compact diagnostic/system widgets: Bench Strength, Agent Health.
4. **Below, full width** — Chat drilldown (suggested prompts + input), a
   secondary surface that doesn't compete with the widgets above it.

A toolbar above the grid holds the **Filter** button
(`src/components/home/home-filter-button.tsx`, same `DropdownMenu` + outline
`Button` + `Filter` icon pattern used on `/jobs` and `/candidates`) and the
**date-range picker** (`src/components/home/home-date-range-picker.tsx`, a
true calendar-grid `Popover` + `Calendar`, not a preset-only dropdown).

**Widget hierarchy:** Today's Focus is the biggest, most prominent widget.
Momentum and Risks are smaller scan widgets on the left; Bench Strength and
Agent Health are compact secondary widgets on the right. All four side
widgets are sized equal to each other, and together (as a stacked pair) equal
Today's Focus's height — enforced via `lg:items-stretch` on the row plus
`grid-rows-2` on each side column. Each card scrolls its own content
internally (`overflow-y-auto` + the `.no-scrollbar` utility) rather than
growing the layout if content overflows its fixed share of the height.

---

## Widgets

### 1. Momentum
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

### 2. Today's Focus
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

### 3. Risks
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

### 4. Bench Strength
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

### 5. Agent Health
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

### 6. Chat drilldown
**File:** `src/components/home/home-chat-panel.tsx`

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

---

## Mock data

All widget content in the current build comes from `src/lib/mock-home.ts`
(`MOCK_MOMENTUM`, `MOCK_TODAYS_FOCUS`, `MOCK_RISKS`, `MOCK_BENCH_STRENGTH`,
`MOCK_AGENT_HEALTH`, `SUGGESTED_PROMPTS`). When a real data pipeline is
designed for any widget, replace the corresponding mock export and the
prop it feeds — the widget components themselves are already shaped around
these typed props and shouldn't need to change.
