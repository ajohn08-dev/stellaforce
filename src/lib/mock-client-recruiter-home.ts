/**
 * UI-preview data only, for the client-recruiter home page ("client
 * delivery workbench") — there is no cross-entity activity/funnel pipeline
 * yet (see CLAUDE.md build order). Numbers are illustrative but internally
 * consistent. Shapes intentionally mirror src/lib/mock-home.ts and the
 * other persona mock files so all four personas' widgets stay structurally
 * consistent even though the content differs.
 */

export type ClientRecruiterMomentumData = {
  heroText: string
  proofPoints: string[]
  trendText: string
}

export const MOCK_CLIENT_RECRUITER_MOMENTUM: ClientRecruiterMomentumData = {
  heroText: "12 candidates moved forward this week",
  proofPoints: [
    "8 submissions sent to clients",
    "5 interviews completed",
    "2 reqs recovered from delayed to on-track",
  ],
  trendText: "Client feedback turnaround improved 12% vs last week",
}

export type ClientRecruiterFocusCta = "Follow Up" | "Send" | "Nudge" | "Resolve" | "Review"

export type ClientRecruiterFocusItem = {
  id: string
  primaryText: string
  contextText: string
  cta: ClientRecruiterFocusCta
}

export const MOCK_CLIENT_RECRUITER_TODAYS_FOCUS: ClientRecruiterFocusItem[] = [
  {
    id: "cr-focus-1",
    primaryText: "Follow up with Priya Desai for onsite availability",
    contextText: "Product Manager · Zenarate",
    cta: "Follow Up",
  },
  {
    id: "cr-focus-2",
    primaryText: "Send 3 shortlisted profiles to client",
    contextText: "Product Designer · Naehas",
    cta: "Send",
  },
  {
    id: "cr-focus-3",
    primaryText: "Nudge client for feedback on 2 submitted candidates",
    contextText: "Backend Engineer · Zenarate",
    cta: "Nudge",
  },
  {
    id: "cr-focus-4",
    primaryText: "Resolve 1 final-round scheduling conflict",
    contextText: "Data Analyst · Naehas",
    cta: "Resolve",
  },
  {
    id: "cr-focus-5",
    primaryText: "Prepare offer package for Senior PM finalist",
    contextText: "Senior PM · Zenarate",
    cta: "Review",
  },
]

export type ClientRecruiterRiskGroupKey =
  | "breaching"
  | "waitingOnClient"
  | "candidateUnresponsive"
  | "schedulingBlocked"

export type ClientRecruiterRiskOwner = "Client" | "Recruiter" | "Candidate" | "Interviewer" | "System"

export type ClientRecruiterRiskItem = {
  text: string
  contextText: string
  owner: ClientRecruiterRiskOwner
}

export type ClientRecruiterRiskGroup = {
  key: ClientRecruiterRiskGroupKey
  label: string
  items: ClientRecruiterRiskItem[]
}

export const MOCK_CLIENT_RECRUITER_RISKS: ClientRecruiterRiskGroup[] = [
  {
    key: "breaching",
    label: "Breaching today",
    items: [
      {
        text: "2 candidates are at risk of SLA breach today",
        contextText: "Product Manager, Backend Engineer · Zenarate",
        owner: "Client",
      },
    ],
  },
  {
    key: "waitingOnClient",
    label: "Waiting on client",
    items: [
      {
        text: "4 candidates are waiting on client feedback",
        contextText: "Product Designer, Data Analyst · Naehas",
        owner: "Client",
      },
      {
        text: "1 offer is blocked by compensation approval",
        contextText: "Senior PM · Zenarate",
        owner: "Client",
      },
    ],
  },
  {
    key: "candidateUnresponsive",
    label: "Candidate unresponsive",
    items: [
      {
        text: "1 candidate is unresponsive after 3 outreach attempts",
        contextText: "Backend Engineer · Zenarate",
        owner: "Candidate",
      },
    ],
  },
  {
    key: "schedulingBlocked",
    label: "Scheduling blocked",
    items: [
      {
        text: "3 interviews are delayed by panel availability",
        contextText: "Marketing Manager · Naehas",
        owner: "Interviewer",
      },
    ],
  },
]

export type CoverageLabel = "strong" | "adequate" | "thin" | "empty"

export type ClientRecruiterCoverageReq = {
  name: string
  account: string
  clientReady: number
  target: number
  coverage: CoverageLabel
}

export type ClientRecruiterCoverageData = {
  activeCoveragePct: number
  reqs: ClientRecruiterCoverageReq[]
}

export const MOCK_CLIENT_RECRUITER_COVERAGE: ClientRecruiterCoverageData = {
  activeCoveragePct: 74,
  reqs: [
    { name: "Product Designer", account: "Naehas", clientReady: 4, target: 5, coverage: "strong" },
    {
      name: "Marketing Manager",
      account: "Zenarate",
      clientReady: 2,
      target: 5,
      coverage: "adequate",
    },
    { name: "Backend Engineer", account: "Zenarate", clientReady: 1, target: 5, coverage: "thin" },
    { name: "Customer Success", account: "Naehas", clientReady: 0, target: 5, coverage: "empty" },
  ],
}

export type FunnelHealthMetric = {
  label: string
  value: string
}

export type FunnelHealthData = {
  submissionToInterviewPct: number
  metrics: FunnelHealthMetric[]
  insightNote?: string
}

export const MOCK_FUNNEL_HEALTH: FunnelHealthData = {
  submissionToInterviewPct: 42,
  metrics: [
    { label: "Client review avg time", value: "3.4 days" },
    { label: "Interview → offer conversion", value: "19%" },
    { label: "Final-round scheduling time", value: "2.1 days" },
  ],
  insightNote: "Biggest leak is client review to interview",
}

export const CLIENT_RECRUITER_SUGGESTED_PROMPTS: string[] = [
  "Which reqs are waiting on client feedback?",
  "Show roles with thin coverage",
  "Where is the funnel leaking across my accounts?",
]
