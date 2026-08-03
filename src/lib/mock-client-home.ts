/**
 * UI-preview data only, for the client-admin home page ("oversight console")
 * — there is no cross-entity activity/performance pipeline yet (see
 * CLAUDE.md build order). Numbers are illustrative but internally
 * consistent. Shapes intentionally mirror src/lib/mock-home.ts (the
 * recruiter equivalent) so the two personas' widgets stay structurally
 * consistent even though the content differs.
 */

export type ClientMomentumData = {
  heroText: string
  proofPoints: string[]
  trendText: string
}

export const MOCK_CLIENT_MOMENTUM: ClientMomentumData = {
  heroText: "3 roles moved to finalist stage this week",
  proofPoints: [
    "2 offers sent",
    "1 priority req filled",
    "4 reqs stayed on track this period",
  ],
  trendText: "Hiring manager turnaround improved 15% vs last week",
}

/**
 * Every item here happens *after* a req is already approved and live on
 * Stella Force — the platform only picks up post-approval, so there is
 * deliberately no req-approval / budget-sign-off / headcount-confirmation
 * content in this list (that happens upstream, before the req ever reaches
 * Stella Force). What belongs here instead: offer approvals, escalations on
 * unresponsive stakeholders, nudges, and candidate-quality calls surfaced
 * during active hiring.
 */
export type ClientFocusCta = "Approve" | "Escalate" | "Review" | "Nudge"

export type ClientFocusItem = {
  id: string
  primaryText: string
  contextText: string
  cta: ClientFocusCta
}

export const MOCK_CLIENT_TODAYS_FOCUS: ClientFocusItem[] = [
  {
    id: "client-focus-1",
    primaryText: "Approve offer package for Senior Backend Engineer",
    contextText: "Engineering · Naehas",
    cta: "Approve",
  },
  {
    id: "client-focus-2",
    primaryText: "Escalate non-response from hiring manager on 2 priority roles",
    contextText: "Engineering, Design",
    cta: "Escalate",
  },
  {
    id: "client-focus-3",
    primaryText: "Review 3 candidates flagged as low match quality for Product Designer",
    contextText: "Design · Zenarate",
    cta: "Review",
  },
  {
    id: "client-focus-4",
    primaryText: "Nudge hiring manager for overdue feedback on Data Analyst interviews",
    contextText: "Data · Naehas",
    cta: "Nudge",
  },
  {
    id: "client-focus-5",
    primaryText: "Approve interview panel change for Customer Success Manager",
    contextText: "Customer Success · Zenarate",
    cta: "Approve",
  },
]

export type RiskAccountabilityGroupKey = "breaching" | "blockedByHm" | "pendingApproval" | "aging"

export type RiskOwner = "Client Admin" | "Hiring Manager" | "Recruiter" | "Interviewer" | "Candidate"

export type RiskAccountabilityItem = {
  text: string
  contextText: string
  owner: RiskOwner
}

export type RiskAccountabilityGroup = {
  key: RiskAccountabilityGroupKey
  label: string
  items: RiskAccountabilityItem[]
}

export const MOCK_RISKS_ACCOUNTABILITY: RiskAccountabilityGroup[] = [
  {
    key: "breaching",
    label: "Breaching today",
    items: [
      {
        text: "1 offer decision overdue",
        contextText: "Senior Backend Engineer · Naehas",
        owner: "Client Admin",
      },
    ],
  },
  {
    key: "blockedByHm",
    label: "Blocked by hiring manager",
    items: [
      {
        text: "3 reqs delayed — blocked by hiring manager feedback",
        contextText: "Engineering, Design, Data",
        owner: "Hiring Manager",
      },
      {
        text: "Scheduling delays concentrated in Marketing interviews",
        contextText: "Marketing",
        owner: "Hiring Manager",
      },
    ],
  },
  {
    key: "pendingApproval",
    label: "Pending internal approval",
    items: [
      {
        text: "2 offers pending internal approval",
        contextText: "Senior Backend Engineer, Product Designer",
        owner: "Client Admin",
      },
    ],
  },
  {
    key: "aging",
    label: "No movement / aging",
    items: [
      {
        text: "1 req has had no movement in 8 days",
        contextText: "Data Analyst · Naehas",
        owner: "Recruiter",
      },
    ],
  },
]

export type CoverageLabel = "strong" | "adequate" | "thin" | "empty"

export type CoverageReq = {
  name: string
  department: string
  finalistReady: number
  target: number
  coverage: CoverageLabel
}

export type CoverageData = {
  priorityCoveragePct: number
  reqs: CoverageReq[]
}

export const MOCK_COVERAGE: CoverageData = {
  priorityCoveragePct: 78,
  reqs: [
    { name: "Senior PM", department: "Product", finalistReady: 4, target: 5, coverage: "strong" },
    {
      name: "Product Designer",
      department: "Design",
      finalistReady: 2,
      target: 5,
      coverage: "adequate",
    },
    { name: "ML Engineer", department: "Data", finalistReady: 1, target: 5, coverage: "thin" },
    {
      name: "Finance Analyst",
      department: "Finance",
      finalistReady: 0,
      target: 5,
      coverage: "empty",
    },
  ],
}

export type HiringPerformanceMetric = {
  label: string
  value: string
}

export type HiringPerformanceData = {
  slaCompliancePct: number
  metrics: HiringPerformanceMetric[]
  insightNote?: string
}

export const MOCK_HIRING_PERFORMANCE: HiringPerformanceData = {
  slaCompliancePct: 89,
  metrics: [
    { label: "Avg time to fill", value: "38 days" },
    { label: "Offer approval cycle time", value: "2.1 days" },
    { label: "Hiring manager response time", value: "1.8 days" },
    { label: "Interview-to-offer conversion", value: "24%" },
  ],
  insightNote: "SLA compliance down 4 pts vs last period",
}

export const CLIENT_SUGGESTED_PROMPTS: string[] = [
  "Which reqs are delayed because of hiring manager feedback?",
  "Show all roles awaiting internal approval",
  "Which business units have the slowest response times?",
]
