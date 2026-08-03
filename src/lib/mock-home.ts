/**
 * UI-preview data only, for the recruiter home page ("mission control") — there
 * is no cross-entity activity/reliability pipeline yet (see CLAUDE.md build
 * order). Numbers are illustrative but internally consistent.
 */

export type MomentumData = {
  heroText: string
  proofPoints: string[]
  trendText: string
}

export const MOCK_MOMENTUM: MomentumData = {
  heroText: "14 candidates advanced this week",
  proofPoints: [
    "9 interviews booked, 7 completed",
    "2 reqs moved from at-risk to on-track",
    "11 automations completed successfully",
  ],
  trendText: "Up 18% vs last week",
}

export type FocusCta = "Review" | "Nudge" | "Resolve" | "Approve" | "Schedule"

export type FocusItem = {
  id: string
  primaryText: string
  contextText: string
  cta: FocusCta
}

export const MOCK_TODAYS_FOCUS: FocusItem[] = [
  {
    id: "focus-1",
    primaryText: "Follow up with Priya Desai — awaiting availability for onsite",
    contextText: "Product Manager · Zenarate",
    cta: "Nudge",
  },
  {
    id: "focus-2",
    primaryText: "Review 3 shortlisted candidates",
    contextText: "Product Designer · Zenarate",
    cta: "Review",
  },
  {
    id: "focus-3",
    primaryText: "Resolve 1 final-round scheduling conflict for Karan Ahuja",
    contextText: "Product Designer · Zenarate",
    cta: "Resolve",
  },
  {
    id: "focus-4",
    primaryText: "Approve 1 offer draft for Backend Engineer",
    contextText: "Naehas",
    cta: "Approve",
  },
  {
    id: "focus-5",
    primaryText: "Schedule onsite loop for Mia Torres",
    contextText: "Senior PM · Naehas",
    cta: "Schedule",
  },
]

export type RiskGroupKey = "breaching" | "blocked" | "stalled"

export type RiskItem = {
  text: string
  contextText: string
}

export type RiskGroup = {
  key: RiskGroupKey
  label: string
  items: RiskItem[]
}

export const MOCK_RISKS: RiskGroup[] = [
  {
    key: "breaching",
    label: "Breaching today",
    items: [{ text: "1 offer decision overdue", contextText: "Backend Engineer · Naehas" }],
  },
  {
    key: "blocked",
    label: "Blocked by others",
    items: [
      { text: "2 interviews blocked by interviewer availability", contextText: "Senior PM · Naehas" },
    ],
  },
  {
    key: "stalled",
    label: "Stalled in stage",
    items: [
      { text: "4 candidates are stalled in HM review", contextText: "Product Manager · Zenarate" },
      { text: "3 candidates nearing feedback SLA breach", contextText: "Product Designer · Zenarate" },
    ],
  },
]

export type CoverageLabel = "strong" | "adequate" | "thin" | "empty"

export type BenchReq = {
  name: string
  client: string
  filled: number
  total: number
  coverage: CoverageLabel
}

export type BenchStrengthData = {
  portfolioCoveragePct: number
  reqs: BenchReq[]
}

export const MOCK_BENCH_STRENGTH: BenchStrengthData = {
  portfolioCoveragePct: 95,
  reqs: [
    { name: "Product Designer", client: "Zenarate", filled: 4, total: 10, coverage: "adequate" },
    { name: "Senior PM", client: "Naehas", filled: 7, total: 10, coverage: "strong" },
    { name: "ML Engineer", client: "Naehas", filled: 1, total: 10, coverage: "thin" },
    { name: "Backend Engineer", client: "Naehas", filled: 0, total: 8, coverage: "empty" },
  ],
}

export type AgentHealthMetric = {
  label: string
  value: string
}

export type AgentHealthData = {
  reliabilityPct: number
  metrics: AgentHealthMetric[]
  degradationNote?: string
}

export const MOCK_AGENT_HEALTH: AgentHealthData = {
  reliabilityPct: 95,
  metrics: [
    { label: "Tasks handled automatically", value: "24" },
    { label: "Exceptions needing review", value: "3" },
    { label: "Manual override rate", value: "8%" },
  ],
  degradationNote: "Calendar sync failures affected 2 runs",
}

export const SUGGESTED_PROMPTS: string[] = [
  "Which reqs are thin right now?",
  "What is driving HM review delays?",
  "Show all candidates at risk of SLA breach today",
]
