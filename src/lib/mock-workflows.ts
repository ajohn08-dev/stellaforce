/**
 * UI-preview data only — the Workflows list renders entirely from this array,
 * there is no `workflow_templates` table yet (see CLAUDE.md build order).
 * Client names match MOCK_JOBS (src/lib/mock-jobs.ts); `client_name: null`
 * marks a generic template reusable across any client.
 */
export type WorkflowStatus = "draft" | "published"

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
