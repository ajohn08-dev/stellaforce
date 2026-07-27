/**
 * UI-preview data only, for the Agents > Analytics page — there is no
 * analytics pipeline yet (see CLAUDE.md build order). Numbers are
 * illustrative but internally consistent (funnel stages strictly decrease,
 * rates read sensibly against each other).
 */

export type StatDelta = {
  /** Signed, formatted for display, e.g. "+5%" or "-8%". */
  text: string
  direction: "up" | "down"
  /** Which direction is actually good for this metric — decides delta color. */
  goodDirection: "up" | "down"
}

export type AnalyticsStat = {
  label: string
  value: string
  delta?: StatDelta
}

export type MetricPoint = {
  label: string
  value: number
}

export type MetricDimension = "job" | "client" | "agent"

export const METRIC_DIMENSIONS: { value: MetricDimension; label: string }[] = [
  { value: "job", label: "Job" },
  { value: "client", label: "Client" },
  { value: "agent", label: "Agent" },
]

/**
 * Date-range filter presets for the Analytics page toolbar. Picking a range
 * doesn't recompute the mock stats/charts themselves — there's no analytics
 * pipeline yet (see file header) — but it does drive the "vs. ___" caption
 * under each stat card's delta, via getAnalyticsComparisonLabel below.
 */
export const ANALYTICS_DATE_RANGE_OPTIONS = [
  "Today",
  "Last 7 Days",
  "Last 30 Days",
  "Jan 1 - Today",
  "All Time",
] as const

export type AnalyticsDateRange = (typeof ANALYTICS_DATE_RANGE_OPTIONS)[number]

export const DEFAULT_ANALYTICS_DATE_RANGE: AnalyticsDateRange = "Jan 1 - Today"

/**
 * Captions a stat card's delta with what it's being compared against —
 * always "shift the range back by its own length." A fixed-length rolling
 * window gets a clean, specific phrase ("Last 7 Days" → "vs. previous 7
 * days"); "Jan 1 - Today" is variable-length (it grows every day), so
 * there's no fixed day-count to name and it falls back to the generic "vs.
 * last period". "All Time" has no equivalent prior period at all, so it
 * gets no caption.
 */
export function getAnalyticsComparisonLabel(range: AnalyticsDateRange): string {
  switch (range) {
    case "Today":
      return "vs. yesterday"
    case "Last 7 Days":
      return "vs. previous 7 days"
    case "Last 30 Days":
      return "vs. previous 30 days"
    case "Jan 1 - Today":
      return "vs. last period"
    case "All Time":
      return ""
  }
}

/** The categories each dimension breaks a metric down by — real job titles/client names/agents, not time. */
const JOB_NAMES = [
  "Senior Full-Stack Engineer",
  "Data Engineer",
  "Staff Backend Engineer",
  "Sales Account Executive",
  "Customer Success Manager",
  "Product Designer",
  "DevOps Engineer",
  "Marketing Manager",
]
export const CLIENT_NAMES = [
  "Northwind Logistics",
  "Acme Fintech",
  "Globex Media",
  "Solstice Health",
  "Vertex Robotics",
  "Meridian Capital",
  "Cascade Retail",
  "Ironclad Security",
]
/**
 * Individual agent instances, not the two agent *types* — a client can spin
 * up many Screening/Interview agents (one per team, role family, etc.), so
 * this list is deliberately longer than AGENT_TYPE_OPTIONS below.
 */
const AGENT_NAMES = [
  "Screening Agent — Engineering",
  "Screening Agent — Sales",
  "Screening Agent — Support",
  "Screening Agent — Design",
  "Interview Agent — Engineering",
  "Interview Agent — Sales",
  "Interview Agent — Support",
  "Interview Agent — Design",
]

function byDimension(job: number[], client: number[], agent: number[]) {
  const toPoints = (labels: string[], values: number[]) =>
    labels.map((label, i) => ({ label, value: values[i] }))
  return {
    job: toPoints(JOB_NAMES, job),
    client: toPoints(CLIENT_NAMES, client),
    agent: toPoints(AGENT_NAMES, agent),
  }
}

export type SystemHealthMetricKey =
  | "completionRate"
  | "escalationRate"
  | "qualificationRate"
  | "manualReviewVolume"

/** Clicking a System Health stat card shows that metric's own by-Job/Client/Agent breakdown below it. */
export const SYSTEM_HEALTH_STATS: (AnalyticsStat & { key: SystemHealthMetricKey })[] = [
  {
    key: "completionRate",
    label: "Completion Rate",
    value: "95%",
    delta: { text: "+5%", direction: "up", goodDirection: "up" },
  },
  {
    key: "escalationRate",
    label: "Escalation Rate",
    value: "15%",
    delta: { text: "-5%", direction: "down", goodDirection: "down" },
  },
  {
    key: "qualificationRate",
    label: "Qualification Rate",
    value: "75%",
    delta: { text: "+3%", direction: "up", goodDirection: "up" },
  },
  {
    key: "manualReviewVolume",
    label: "Manual Review Volume",
    value: "75%",
    delta: { text: "-4%", direction: "down", goodDirection: "down" },
  },
]

/** Each System Health metric's own value (all percentages, 0-100) broken down by job/client/agent. */
export const SYSTEM_HEALTH_BREAKDOWNS: Record<
  SystemHealthMetricKey,
  Record<MetricDimension, MetricPoint[]>
> = {
  completionRate: byDimension(
    [93, 96, 91, 97, 94, 95, 92, 98],
    [92, 95, 90, 96, 93, 94, 91, 97],
    [95, 93, 96, 94, 92, 97, 91, 95]
  ),
  escalationRate: byDimension(
    [14, 18, 12, 16, 15, 17, 13, 19],
    [17, 13, 19, 15, 14, 16, 12, 18],
    [15, 17, 14, 16, 13, 18, 15, 17]
  ),
  qualificationRate: byDimension(
    [72, 78, 68, 76, 74, 77, 70, 75],
    [70, 75, 66, 79, 73, 77, 69, 76],
    [75, 71, 77, 73, 69, 78, 74, 76]
  ),
  manualReviewVolume: byDimension(
    [74, 70, 78, 72, 76, 71, 79, 73],
    [71, 77, 69, 75, 73, 78, 70, 76],
    [73, 78, 71, 76, 74, 79, 72, 77]
  ),
}

export type SankeyNode = {
  id: string
  label: string
  /** Tailwind bg-* class + matching raw hex (for SVG gradient stops). */
  colorClass: string
  colorHex: string
}

export type SankeyLink = {
  source: string
  target: string
  value: number
}

/**
 * The candidate flow widget covers whichever agent is selected — aggregated
 * across every job currently using that agent, not scoped to one job. Each
 * agent has its own flow shape since they do different work: Screening
 * Agent (phone + video) triages incoming applicants; Interview Agent
 * (video only) runs the interview itself once a candidate is in-loop.
 */
export type AgentType = "screening" | "interview"

export const AGENT_TYPE_OPTIONS: { value: AgentType; label: string }[] = [
  { value: "screening", label: "Screening Agent" },
  { value: "interview", label: "Interview Agent" },
]

export type AgentFunnel = {
  sourceNodes: SankeyNode[]
  targetNodes: SankeyNode[]
  links: SankeyLink[]
}

/**
 * Screening Agent: how completed screenings (447 candidates, across every
 * job using the agent) split by how the candidate entered the pipeline,
 * then land in one of three outcomes. Column totals are internally
 * consistent: Applied Directly (260) + Sourced by Recruiter (187) = 447;
 * Qualified (312) + Escalated (96) + Flagged (39) = 447.
 */
const SCREENING_AGENT_FUNNEL: AgentFunnel = {
  sourceNodes: [
    { id: "applied", label: "Applied Directly", colorClass: "bg-brand-purple-600", colorHex: "#770df2" },
    { id: "sourced", label: "Sourced by Recruiter", colorClass: "bg-brand-orange-600", colorHex: "#e0531f" },
  ],
  targetNodes: [
    { id: "qualified", label: "Qualified", colorClass: "bg-brand-purple-400", colorHex: "#ae6ef7" },
    { id: "escalated", label: "Escalated to Recruiter", colorClass: "bg-brand-neutral-600", colorHex: "#7f738c" },
    { id: "flagged", label: "Flagged for Review", colorClass: "bg-brand-orange-400", colorHex: "#ec9879" },
  ],
  links: [
    { source: "applied", target: "qualified", value: 165 },
    { source: "applied", target: "escalated", value: 60 },
    { source: "applied", target: "flagged", value: 35 },
    { source: "sourced", target: "qualified", value: 147 },
    { source: "sourced", target: "escalated", value: 36 },
    { source: "sourced", target: "flagged", value: 4 },
  ],
}

/**
 * Interview Agent: how candidates entering an agent-run interview (200,
 * across every job using the agent) got there, then land in one of three
 * outcomes. Column totals: Advanced from Screening (150) + Direct Referral
 * (50) = 200; Advance to Next Stage (88) + On Hold for Review (47) + Rejected
 * (65) = 200.
 */
const INTERVIEW_AGENT_FUNNEL: AgentFunnel = {
  sourceNodes: [
    { id: "advanced", label: "Advanced from Screening", colorClass: "bg-brand-purple-600", colorHex: "#770df2" },
    { id: "referral", label: "Direct Referral", colorClass: "bg-brand-orange-600", colorHex: "#e0531f" },
  ],
  targetNodes: [
    { id: "offer", label: "Advance to Next Stage", colorClass: "bg-brand-purple-400", colorHex: "#ae6ef7" },
    { id: "hold", label: "On Hold for Review", colorClass: "bg-brand-neutral-600", colorHex: "#7f738c" },
    { id: "rejected", label: "Rejected", colorClass: "bg-brand-orange-400", colorHex: "#ec9879" },
  ],
  links: [
    { source: "advanced", target: "offer", value: 70 },
    { source: "advanced", target: "hold", value: 35 },
    { source: "advanced", target: "rejected", value: 45 },
    { source: "referral", target: "offer", value: 18 },
    { source: "referral", target: "hold", value: 12 },
    { source: "referral", target: "rejected", value: 20 },
  ],
}

export const AGENT_CANDIDATE_FUNNELS: Record<AgentType, AgentFunnel> = {
  screening: SCREENING_AGENT_FUNNEL,
  interview: INTERVIEW_AGENT_FUNNEL,
}

export type OperationalEfficiencyMetricKey =
  | "totalScreeningsCompleted"
  | "averageHandleTime"
  | "timeSaved"
  | "candidateCSAT"

/** Clicking an Operational Efficiency stat card shows that metric's own by-Job/Client/Agent breakdown below it. */
export const OPERATIONAL_EFFICIENCY_STATS: (AnalyticsStat & {
  key: OperationalEfficiencyMetricKey
})[] = [
  {
    key: "totalScreeningsCompleted",
    label: "Total Screenings Completed",
    value: "95",
    delta: { text: "+5%", direction: "up", goodDirection: "up" },
  },
  {
    key: "averageHandleTime",
    label: "Average Handle Time",
    value: "15:30 min",
    delta: { text: "-8%", direction: "down", goodDirection: "down" },
  },
  {
    key: "timeSaved",
    label: "Time Saved",
    value: "16 hrs",
    delta: { text: "+2 hrs", direction: "up", goodDirection: "up" },
  },
  {
    key: "candidateCSAT",
    label: "Candidate CSAT",
    value: "75%",
    delta: { text: "+2%", direction: "up", goodDirection: "up" },
  },
]

/** Chart y-axis shape per metric — each is a different unit, so each gets its own scale. */
export const OPERATIONAL_EFFICIENCY_CHART_CONFIG: Record<
  OperationalEfficiencyMetricKey,
  { yMax: number; yTicks: number[]; valueSuffix: string }
> = {
  totalScreeningsCompleted: { yMax: 50, yTicks: [0, 10, 20, 30, 40, 50], valueSuffix: "" },
  averageHandleTime: { yMax: 20, yTicks: [0, 5, 10, 15, 20], valueSuffix: " min" },
  timeSaved: { yMax: 12, yTicks: [0, 3, 6, 9, 12], valueSuffix: " hrs" },
  candidateCSAT: { yMax: 100, yTicks: [0, 25, 50, 75, 100], valueSuffix: "%" },
}

export const OPERATIONAL_EFFICIENCY_BREAKDOWNS: Record<
  OperationalEfficiencyMetricKey,
  Record<MetricDimension, MetricPoint[]>
> = {
  totalScreeningsCompleted: byDimension(
    [22, 18, 15, 25, 15, 20, 17, 23],
    [20, 24, 16, 19, 16, 21, 18, 22],
    // Per-agent counts sum to the same screening (58) / interview (37) totals
    // the old two-agent-type version used, now split across individual agents.
    [16, 14, 15, 13, 10, 9, 11, 7]
  ),
  averageHandleTime: byDimension(
    [15.2, 17.8, 13.9, 16.5, 14.7, 16.9, 14.2, 17.1],
    [16.1, 14.3, 18.2, 15.5, 13.8, 15.9, 14.6, 17.3],
    [14.2, 15.6, 13.8, 15.0, 16.9, 15.8, 17.5, 16.2]
  ),
  timeSaved: byDimension(
    [3.5, 2.8, 4.2, 2.5, 3.0, 3.3, 2.7, 3.8],
    [3.2, 3.8, 2.6, 3.4, 3.0, 3.6, 2.9, 3.3],
    [2.8, 2.5, 2.4, 2.3, 1.6, 1.5, 1.4, 1.5]
  ),
  candidateCSAT: byDimension(
    [78, 72, 80, 70, 76, 74, 79, 71],
    [74, 79, 71, 77, 73, 76, 70, 78],
    [76, 78, 75, 79, 72, 74, 71, 75]
  ),
}

export type RankedItem = {
  label: string
  value: number
}

/** Percent of screenings flagged for a suspicious (likely coached/scripted) answer, by job. */
export const SUSPICIOUS_ANSWER_RATE_BY_JOB: RankedItem[] = [
  { label: "Senior Full-Stack Engineer", value: 32 },
  { label: "Data Engineer", value: 27 },
  { label: "Staff Backend Engineer", value: 21 },
  { label: "Sales Account Executive", value: 14 },
]

/** Estimated bot/automation likelihood, by job. */
export const BOT_LIKELIHOOD_BY_JOB: RankedItem[] = [
  { label: "Sales Account Executive", value: 29 },
  { label: "Data Engineer", value: 22 },
  { label: "Senior Full-Stack Engineer", value: 18 },
  { label: "Customer Success Manager", value: 11 },
]

export const COMPLIANCE_ESCALATE_REASONS: RankedItem[] = [
  { label: "Inconsistent employment dates", value: 41 },
  { label: "Unverifiable references", value: 36 },
  { label: "Salary expectations mismatch", value: 30 },
  { label: "Missing certification", value: 24 },
  { label: "Location / visa mismatch", value: 19 },
  { label: "Background check flag", value: 15 },
  { label: "Duplicate application", value: 9 },
  { label: "Incomplete answers", value: 6 },
]

export const TOP_EXCEPTION_REASONS: RankedItem[] = [
  { label: "Timeout — no response", value: 22 },
  { label: "Technical / audio issue", value: 17 },
  { label: "Candidate opted out", value: 11 },
  { label: "Duplicate session", value: 5 },
]
