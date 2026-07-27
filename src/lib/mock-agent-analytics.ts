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

export type TrendPoint = {
  label: string
  value: number
}

export type MetricDimension = "job" | "client" | "workflow"

export const METRIC_DIMENSIONS: { value: MetricDimension; label: string }[] = [
  { value: "job", label: "Job" },
  { value: "client", label: "Client" },
  { value: "workflow", label: "Workflow" },
]

export const SYSTEM_HEALTH_STATS: AnalyticsStat[] = [
  {
    label: "Completion Rate",
    value: "95%",
    delta: { text: "+5%", direction: "up", goodDirection: "up" },
  },
  {
    label: "Escalation Rate",
    value: "15%",
    delta: { text: "-5%", direction: "down", goodDirection: "down" },
  },
  { label: "Qualification Rate", value: "75%" },
  { label: "Manual Review Volume", value: "75%" },
]

const WEEK_LABELS = ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5", "Wk 6", "Wk 7", "Wk 8"]

/** Screenings completed per week, by dimension the toggle scopes to. */
export const SCREENINGS_TREND: Record<MetricDimension, TrendPoint[]> = {
  job: [210, 235, 198, 260, 275, 250, 290, 268].map((value, i) => ({
    label: WEEK_LABELS[i],
    value,
  })),
  client: [180, 205, 220, 215, 240, 260, 255, 280].map((value, i) => ({
    label: WEEK_LABELS[i],
    value,
  })),
  workflow: [240, 220, 260, 245, 230, 275, 265, 300].map((value, i) => ({
    label: WEEK_LABELS[i],
    value,
  })),
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
 * (50) = 200; Advanced to Offer (88) + On Hold for Review (47) + Rejected
 * (65) = 200.
 */
const INTERVIEW_AGENT_FUNNEL: AgentFunnel = {
  sourceNodes: [
    { id: "advanced", label: "Advanced from Screening", colorClass: "bg-brand-purple-600", colorHex: "#770df2" },
    { id: "referral", label: "Direct Referral", colorClass: "bg-brand-orange-600", colorHex: "#e0531f" },
  ],
  targetNodes: [
    { id: "offer", label: "Advanced to Offer", colorClass: "bg-brand-purple-400", colorHex: "#ae6ef7" },
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

export const OPERATIONAL_EFFICIENCY_STATS: AnalyticsStat[] = [
  {
    label: "Total Screenings Completed",
    value: "95",
    delta: { text: "+5%", direction: "up", goodDirection: "up" },
  },
  {
    label: "Average Handle Time",
    value: "15:30 min",
    delta: { text: "-8%", direction: "down", goodDirection: "down" },
  },
  { label: "Time Saved", value: "16 hrs" },
  { label: "Candidate CSAT", value: "75%" },
]

/** Average handle time (minutes) per week, by dimension. */
export const HANDLE_TIME_TREND: Record<MetricDimension, TrendPoint[]> = {
  job: [18, 17, 16.5, 15, 15.8, 14.5, 15.3, 13.9].map((value, i) => ({
    label: WEEK_LABELS[i],
    value,
  })),
  client: [19, 18.2, 17, 16.5, 16, 15.5, 14.8, 15.2].map((value, i) => ({
    label: WEEK_LABELS[i],
    value,
  })),
  workflow: [16.5, 17, 15.9, 16.2, 14.7, 15, 13.8, 14.1].map((value, i) => ({
    label: WEEK_LABELS[i],
    value,
  })),
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
