/**
 * UI-preview data only, for the internal-admin home page ("operations
 * command center") — there is no cross-entity activity/performance
 * pipeline yet (see CLAUDE.md build order). Numbers are illustrative but
 * internally consistent. Shapes intentionally mirror src/lib/mock-home.ts
 * and src/lib/mock-client-home.ts so all three personas' widgets stay
 * structurally consistent even though the content differs.
 */

export type InternalAdminMomentumData = {
  heroText: string
  proofPoints: string[]
  trendText: string
}

export const MOCK_INTERNAL_ADMIN_MOMENTUM: InternalAdminMomentumData = {
  heroText: "18 candidates advanced this week",
  proofPoints: [
    "6 interviews completed across your reqs",
    "3 client reqs moved back on track",
    "Scheduling agent resolved 24 bookings without admin intervention",
  ],
  trendText: "SLA compliance improved 6 pts this week",
}

export type InternalAdminFocusCta = "Escalate" | "Review" | "Resolve" | "Reassign" | "Approve"

export type InternalAdminFocusItem = {
  id: string
  primaryText: string
  contextText: string
  cta: InternalAdminFocusCta
}

export const MOCK_INTERNAL_ADMIN_TODAYS_FOCUS: InternalAdminFocusItem[] = [
  {
    id: "admin-focus-1",
    primaryText: "Escalate 2 hiring manager feedback breaches on Zenarate roles",
    contextText: "Zenarate · Multiple reqs",
    cta: "Escalate",
  },
  {
    id: "admin-focus-2",
    primaryText: "Review 3 recruiter backlogs with stalled reqs",
    contextText: "Recruiting team",
    cta: "Review",
  },
  {
    id: "admin-focus-3",
    primaryText: "Resolve calendar sync failures affecting final-round scheduling",
    contextText: "Platform · Calendar integration",
    cta: "Resolve",
  },
  {
    id: "admin-focus-4",
    primaryText: "Reassign Product Designer req to a recruiter with capacity",
    contextText: "Zenarate · Design",
    cta: "Reassign",
  },
  {
    id: "admin-focus-5",
    primaryText: "Grant client admin access for Acme hiring team",
    contextText: "Acme · Access request",
    cta: "Approve",
  },
]

export type AdminRiskGroupKey = "breaching" | "blockedByHm" | "recruiterOverload" | "systemCaused"

export type AdminRiskOwner = "Recruiter" | "Hiring Manager" | "Client Admin" | "Interviewer" | "System"

export type AdminRiskItem = {
  text: string
  contextText: string
  owner: AdminRiskOwner
}

export type AdminRiskGroup = {
  key: AdminRiskGroupKey
  label: string
  items: AdminRiskItem[]
}

export const MOCK_ADMIN_RISKS_ACCOUNTABILITY: AdminRiskGroup[] = [
  {
    key: "breaching",
    label: "Breaching today",
    items: [
      {
        text: "3 reqs breached SLA today",
        contextText: "Zenarate, Naehas",
        owner: "Hiring Manager",
      },
    ],
  },
  {
    key: "blockedByHm",
    label: "Blocked by hiring manager",
    items: [
      {
        text: "4 reqs delayed — awaiting hiring manager feedback",
        contextText: "Zenarate, Naehas",
        owner: "Hiring Manager",
      },
    ],
  },
  {
    key: "recruiterOverload",
    label: "Recruiter overload",
    items: [
      {
        text: "2 recruiters have overloaded backlogs",
        contextText: "Priya Desai, Sam Okafor",
        owner: "Recruiter",
      },
    ],
  },
  {
    key: "systemCaused",
    label: "System-caused delays",
    items: [
      {
        text: "Calendar integration issues blocked 5 interviews",
        contextText: "Platform-wide",
        owner: "System",
      },
      {
        text: "3 client accounts show rising scheduling delays",
        contextText: "Acme, Zenarate, Naehas",
        owner: "System",
      },
    ],
  },
]

export type PlatformHealthMetric = {
  label: string
  value: string
}

export type PlatformHealthData = {
  reliabilityPct: number
  metrics: PlatformHealthMetric[]
  degradationNote?: string
}

export const MOCK_PLATFORM_HEALTH: PlatformHealthData = {
  reliabilityPct: 96,
  metrics: [
    { label: "Client orgs affected by calendar sync lag", value: "2" },
    { label: "Workflow exceptions needing admin review", value: "5" },
    { label: "Users blocked by missing permissions", value: "3" },
  ],
  degradationNote: "Email delivery dipped 4% vs last week",
}

export type PerformanceStatus = "on_target" | "needs_attention" | "overloaded"

export type PerformanceItem = {
  name: string
  context: string
  metric: string
  status: PerformanceStatus
}

export type TeamClientPerformanceData = {
  teamSlaCompliancePct: number
  items: PerformanceItem[]
}

export const MOCK_TEAM_CLIENT_PERFORMANCE: TeamClientPerformanceData = {
  teamSlaCompliancePct: 91,
  items: [
    {
      name: "Priya Desai",
      context: "Recruiter · Engineering",
      metric: "5.2 days avg",
      status: "needs_attention",
    },
    {
      name: "Sam Okafor",
      context: "Recruiter · Design",
      metric: "14 active reqs",
      status: "overloaded",
    },
    {
      name: "Acme",
      context: "Client portfolio",
      metric: "32% delay rate",
      status: "needs_attention",
    },
    {
      name: "East Region",
      context: "Avg time to fill",
      metric: "34 days",
      status: "on_target",
    },
  ],
}

export const INTERNAL_ADMIN_SUGGESTED_PROMPTS: string[] = [
  "Which recruiters have the most SLA breaches this week?",
  "Show clients affected by sync failures",
  "Which reqs are stalled because of hiring manager response time?",
]
