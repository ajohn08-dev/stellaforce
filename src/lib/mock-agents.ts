/**
 * UI-preview data only — the Screening Agent page renders entirely from this
 * array, there is no `screening_agents` table yet (see CLAUDE.md build
 * order). Client names match MOCK_JOBS/MOCK_WORKFLOWS; `client_names: []`
 * marks a generic agent not yet assigned to any client.
 */
export type AgentStatus = "active" | "inactive"

export type MockScreeningAgent = {
  agent_id: string
  name: string
  description: string
  status: AgentStatus
  client_names: string[]
  avg_handle_time_minutes: number
  updated_at: string
}

export const MOCK_SCREENING_AGENTS: MockScreeningAgent[] = [
  {
    agent_id: "sa-01",
    name: "Engineering First-Pass Screen",
    description:
      "Screens engineering applicants against role fundamentals and years of experience before a recruiter touches the file.",
    status: "active",
    client_names: ["Northwind Logistics", "Meridian Freight"],
    avg_handle_time_minutes: 4,
    updated_at: "2026-07-18",
  },
  {
    agent_id: "sa-02",
    name: "Sales AE Qualifier",
    description:
      "Confirms quota-carrying experience and territory fit for account executive applicants ahead of the live role-play stage.",
    status: "active",
    client_names: ["Acme Fintech"],
    avg_handle_time_minutes: 3,
    updated_at: "2026-07-21",
  },
  {
    agent_id: "sa-03",
    name: "Generalist Recruiter Screen",
    description:
      "Baseline availability, compensation, and location screen reused across roles without a specialized agent.",
    status: "active",
    client_names: ["Globex Media", "Solstice Health", "Vertex Robotics"],
    avg_handle_time_minutes: 5,
    updated_at: "2026-06-30",
  },
  {
    agent_id: "sa-04",
    name: "Executive Search Pre-Screen",
    description:
      "Confirms scope, motivation, and comp expectations for VP+ candidates before the board-style panel.",
    status: "inactive",
    client_names: [],
    avg_handle_time_minutes: 8,
    updated_at: "2026-04-02",
  },
  {
    agent_id: "sa-05",
    name: "Data & Analytics Screen",
    description:
      "SQL fluency and case-study readiness check for data engineer and analyst applicants.",
    status: "active",
    client_names: ["Vertex Robotics"],
    avg_handle_time_minutes: 6,
    updated_at: "2026-07-10",
  },
  {
    agent_id: "sa-06",
    name: "CSM Onboarding Screen",
    description:
      "Lightweight availability and customer-facing experience check for customer success manager applicants.",
    status: "inactive",
    client_names: ["Solstice Health"],
    avg_handle_time_minutes: 2,
    updated_at: "2026-05-14",
  },
]
