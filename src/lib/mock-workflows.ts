/**
 * UI-preview data only — the Workflows list renders entirely from this array,
 * there is no `workflow_templates` table yet (see CLAUDE.md build order).
 * Client names match MOCK_JOBS (src/lib/mock-jobs.ts); `client_name: null`
 * marks a generic template reusable across any client.
 */
export type WorkflowStatus = "draft" | "published"

/** Fixed Tier-1 stages, mirrors the pipeline_stage enum (source|screen|interview|offer|close). */
export type MainStageKey = "source" | "screen" | "interview" | "offer" | "close"

/**
 * The master Scale list for workflow sub-stage decisions. Defined once here
 * and read by both the Workflows "Create Workflow" Stages editor (where a
 * scale is picked per sub-stage) and the job draft Workflow step (where the
 * scale is shown read-only, derived from whichever workflow template the
 * job was built from) — the two must never diverge. Matches the DB's
 * `rating_scale` enum exactly (see CLAUDE.md) — not applicable to
 * offer-stage sub-stages, which use a hire-recommendation toggle instead
 * (see MockWorkflowStage.hireRecommendationEnabled).
 */
export type SubStageScale = "star" | "ten-point" | "hundred-point"

export const SCALE_OPTIONS: { value: SubStageScale; label: string }[] = [
  { value: "star", label: "Star Rating" },
  { value: "ten-point", label: "Ten-point scale (1-10)" },
  { value: "hundred-point", label: "Hundred-point scale (1-100)" },
]

export const SCALE_LABEL: Record<SubStageScale, string> = Object.fromEntries(
  SCALE_OPTIONS.map((o) => [o.value, o.label])
) as Record<SubStageScale, string>

/**
 * A Tier-2 sub-stage on a workflow template — the source of truth a job
 * draft reads its per-stage Scale from. `scale` and `hireRecommendationEnabled`
 * are mutually exclusive in practice: offer stages capture a hire
 * recommendation instead of a rating scale (see the Decision panel in
 * workflow-stages-tab.tsx).
 */
export type MockWorkflowStage = {
  id: string
  mainStage: MainStageKey
  name: string
  purpose: string
  scale?: SubStageScale
  hireRecommendationEnabled?: boolean
}

export type MockWorkflow = {
  workflow_id: string
  name: string
  status: WorkflowStatus
  description: string
  department: string
  client_name: string | null
  created_by: string
  created_at: string
  updated_at: string
  stages: MockWorkflowStage[]
}

export const MOCK_WORKFLOWS: MockWorkflow[] = [
  {
    workflow_id: "wf-01",
    name: "Standard Engineering Pipeline",
    status: "published",
    description:
      "Default 5-stage pipeline for full-stack and backend engineering roles: recruiter screen, technical phone screen, take-home, onsite loop, offer.",
    department: "Engineering",
    client_name: null,
    created_by: "Anna John",
    created_at: "2026-01-12",
    updated_at: "2026-05-02",
    stages: [
      { id: "wf-01-s1", mainStage: "screen", name: "Recruiter Screen", purpose: "Confirm baseline qualifications and interest", scale: "ten-point" },
      { id: "wf-01-s2", mainStage: "screen", name: "Technical Phone Screen", purpose: "Validate core technical fundamentals", scale: "ten-point" },
      { id: "wf-01-s3", mainStage: "interview", name: "Take-Home Exercise", purpose: "Hands-on skills assessment", scale: "ten-point" },
      { id: "wf-01-s4", mainStage: "interview", name: "Onsite Loop", purpose: "Full-loop technical and behavioral evaluation", scale: "star" },
      { id: "wf-01-s5", mainStage: "offer", name: "Offer", purpose: "Extend and negotiate the offer", hireRecommendationEnabled: true },
    ],
  },
  {
    workflow_id: "wf-02",
    name: "Northwind Logistics — Ops Hiring",
    status: "published",
    description:
      "Client-specific workflow for warehouse and logistics operations roles, includes a background-check gate before offer.",
    department: "Operations",
    client_name: "Northwind Logistics",
    created_by: "Diego Fernandez",
    created_at: "2026-02-03",
    updated_at: "2026-06-18",
    stages: [
      { id: "wf-02-s1", mainStage: "screen", name: "Recruiter Screen", purpose: "Confirm availability and logistics fit", scale: "ten-point" },
      { id: "wf-02-s2", mainStage: "interview", name: "Site Interview", purpose: "Evaluate hands-on operations experience", scale: "star" },
      { id: "wf-02-s3", mainStage: "offer", name: "Background Check", purpose: "Background and reference checks", hireRecommendationEnabled: true },
      { id: "wf-02-s4", mainStage: "offer", name: "Offer", purpose: "Extend and negotiate the offer", hireRecommendationEnabled: true },
    ],
  },
  {
    workflow_id: "wf-03",
    name: "Growth PM Loop (Draft)",
    status: "draft",
    description:
      "Product manager pipeline emphasizing growth case studies and a metrics-driven take-home exercise ahead of the onsite panel.",
    department: "Product",
    client_name: "Globex Media",
    created_by: "Priya Nair",
    created_at: "2026-06-20",
    updated_at: "2026-07-10",
    stages: [
      { id: "wf-03-s1", mainStage: "screen", name: "Recruiter Screen", purpose: "Confirm baseline qualifications and interest", scale: "ten-point" },
      { id: "wf-03-s2", mainStage: "interview", name: "Growth Case Study", purpose: "Evaluate growth strategy and metrics fluency", scale: "ten-point" },
      { id: "wf-03-s3", mainStage: "interview", name: "Onsite Panel", purpose: "Cross-functional panel evaluation", scale: "star" },
      { id: "wf-03-s4", mainStage: "offer", name: "Offer", purpose: "Extend and negotiate the offer", hireRecommendationEnabled: true },
    ],
  },
  {
    workflow_id: "wf-04",
    name: "Executive Search — VP & Above",
    status: "published",
    description:
      "Extended loop for VP+ hires: exec screen, board-style panel, references, and a compensation committee review.",
    department: "Executive",
    client_name: null,
    created_by: "Anna John",
    created_at: "2025-11-08",
    updated_at: "2026-04-14",
    stages: [
      { id: "wf-04-s1", mainStage: "screen", name: "Executive Screen", purpose: "Confirm scope, motivation, and comp expectations", scale: "ten-point" },
      { id: "wf-04-s2", mainStage: "interview", name: "Board-Style Panel", purpose: "Cross-functional leadership evaluation", scale: "star" },
      { id: "wf-04-s3", mainStage: "interview", name: "References", purpose: "Structured reference checks", scale: "ten-point" },
      { id: "wf-04-s4", mainStage: "offer", name: "Compensation Committee Review", purpose: "Final comp and offer sign-off", hireRecommendationEnabled: true },
    ],
  },
  {
    workflow_id: "wf-05",
    name: "Data & Analytics Hiring Loop",
    status: "published",
    description:
      "Pipeline for data engineer and analyst roles with a SQL/case-study screen before the onsite.",
    department: "Data & Analytics",
    client_name: "Vertex Robotics",
    created_by: "Priya Nair",
    created_at: "2026-03-01",
    updated_at: "2026-06-29",
    stages: [
      { id: "wf-05-s1", mainStage: "screen", name: "Recruiter Screen", purpose: "Confirm baseline qualifications and interest", scale: "ten-point" },
      { id: "wf-05-s2", mainStage: "screen", name: "SQL / Case Study Screen", purpose: "Validate SQL fluency and analytical reasoning", scale: "ten-point" },
      { id: "wf-05-s3", mainStage: "interview", name: "Onsite Loop", purpose: "Full-loop technical and behavioral evaluation", scale: "star" },
      { id: "wf-05-s4", mainStage: "offer", name: "Offer", purpose: "Extend and negotiate the offer", hireRecommendationEnabled: true },
    ],
  },
  {
    workflow_id: "wf-06",
    name: "Sales AE Ramp Pipeline (Draft)",
    status: "draft",
    description:
      "Account executive pipeline with a live role-play stage and a manager shadow day before final offer.",
    department: "Sales",
    client_name: "Acme Fintech",
    created_by: "Diego Fernandez",
    created_at: "2026-07-01",
    updated_at: "2026-07-15",
    stages: [
      { id: "wf-06-s1", mainStage: "screen", name: "Recruiter Screen", purpose: "Confirm baseline qualifications and interest", scale: "ten-point" },
      { id: "wf-06-s2", mainStage: "interview", name: "Live Role-Play", purpose: "Evaluate live sales conversation skills", scale: "star" },
      { id: "wf-06-s3", mainStage: "interview", name: "Manager Shadow Day", purpose: "Observe fit in a live team setting", scale: "ten-point" },
      { id: "wf-06-s4", mainStage: "offer", name: "Offer", purpose: "Extend and negotiate the offer", hireRecommendationEnabled: true },
    ],
  },
  {
    workflow_id: "wf-07",
    name: "Customer Success Onboarding Hire",
    status: "published",
    description:
      "Lightweight 3-stage loop for CSM hires: recruiter screen, panel interview, offer.",
    department: "Customer Success",
    client_name: "Solstice Health",
    created_by: "Anna John",
    created_at: "2026-01-25",
    updated_at: "2026-05-30",
    stages: [
      { id: "wf-07-s1", mainStage: "screen", name: "Recruiter Screen", purpose: "Confirm baseline qualifications and interest", scale: "ten-point" },
      { id: "wf-07-s2", mainStage: "interview", name: "Panel Interview", purpose: "Cross-functional CSM evaluation", scale: "star" },
      { id: "wf-07-s3", mainStage: "offer", name: "Offer", purpose: "Extend and negotiate the offer", hireRecommendationEnabled: true },
    ],
  },
  {
    workflow_id: "wf-08",
    name: "Marketing Generalist Loop (Draft)",
    status: "draft",
    description:
      "Draft workflow for early-career marketing hires, still missing a finalized scorecard for the writing sample stage.",
    department: "Marketing",
    client_name: null,
    created_by: "Priya Nair",
    created_at: "2026-07-05",
    updated_at: "2026-07-20",
    stages: [
      { id: "wf-08-s1", mainStage: "screen", name: "Recruiter Screen", purpose: "Confirm baseline qualifications and interest", scale: "ten-point" },
      { id: "wf-08-s2", mainStage: "interview", name: "Writing Sample Review", purpose: "Evaluate writing sample against role scorecard", scale: "ten-point" },
      { id: "wf-08-s3", mainStage: "offer", name: "Offer", purpose: "Extend and negotiate the offer", hireRecommendationEnabled: true },
    ],
  },
  {
    workflow_id: "wf-09",
    name: "Meridian Freight — Frontend Hiring",
    status: "published",
    description:
      "Frontend engineering loop customized for Meridian Freight, includes a design-system pairing exercise.",
    department: "Engineering",
    client_name: "Meridian Freight",
    created_by: "Anna John",
    created_at: "2025-12-15",
    updated_at: "2026-03-22",
    stages: [
      { id: "wf-09-s1", mainStage: "screen", name: "Recruiter Screen", purpose: "Confirm baseline qualifications and interest", scale: "ten-point" },
      { id: "wf-09-s2", mainStage: "screen", name: "Technical Phone Screen", purpose: "Validate core frontend fundamentals", scale: "ten-point" },
      { id: "wf-09-s3", mainStage: "interview", name: "Design-System Pairing", purpose: "Hands-on pairing against the design system", scale: "star" },
      { id: "wf-09-s4", mainStage: "interview", name: "Onsite Loop", purpose: "Full-loop technical and behavioral evaluation", scale: "star" },
      { id: "wf-09-s5", mainStage: "offer", name: "Offer", purpose: "Extend and negotiate the offer", hireRecommendationEnabled: true },
    ],
  },
  {
    workflow_id: "wf-10",
    name: "Security Engineering Loop",
    status: "published",
    description:
      "Security engineer pipeline with a mandatory background check and a hands-on incident-response scenario.",
    department: "Engineering",
    client_name: "Acme Fintech",
    created_by: "Diego Fernandez",
    created_at: "2026-02-18",
    updated_at: "2026-06-05",
    stages: [
      { id: "wf-10-s1", mainStage: "screen", name: "Recruiter Screen", purpose: "Confirm baseline qualifications and interest", scale: "ten-point" },
      { id: "wf-10-s2", mainStage: "offer", name: "Background Check", purpose: "Mandatory background and clearance check", hireRecommendationEnabled: true },
      { id: "wf-10-s3", mainStage: "interview", name: "Incident-Response Scenario", purpose: "Hands-on incident-response simulation", scale: "ten-point" },
      { id: "wf-10-s4", mainStage: "interview", name: "Onsite Loop", purpose: "Full-loop technical and behavioral evaluation", scale: "star" },
      { id: "wf-10-s5", mainStage: "offer", name: "Offer", purpose: "Extend and negotiate the offer", hireRecommendationEnabled: true },
    ],
  },
]

/** Distinct client names, for the workflow filter/create pickers. Excludes generic (null) templates. */
export const MOCK_WORKFLOW_CLIENTS: string[] = Array.from(
  new Set(
    MOCK_WORKFLOWS.map((w) => w.client_name).filter(
      (c): c is string => c !== null
    )
  )
).sort()

/** Distinct departments, for the workflow filter picker. */
export const MOCK_WORKFLOW_DEPARTMENTS: string[] = Array.from(
  new Set(MOCK_WORKFLOWS.map((w) => w.department))
).sort()
