import type { JobStatus } from "@/lib/supabase/types"

/**
 * UI-preview data only — the Jobs list renders entirely from this array, not
 * from `job_orders`. Client names match the ones seeded in scripts/seed.ts
 * (Northwind Logistics, Acme Fintech, Globex Media) plus a couple of new
 * fictional clients for variety. Nothing here is written to Supabase.
 */
/** Candidate headcount at each stage of the fixed pipeline funnel, shown on job cards. */
export type PipelineCounts = {
  source: number
  screen: number
  interview: number
  offer: number
  close: number
}

/** "draft" isn't a real job_status DB value — it's a mock-only, pre-posting state for this UI preview. */
export type MockJobStatus = JobStatus | "draft"

export type MockJob = {
  job_id: string
  title: string
  openings: number
  client_name: string
  status: MockJobStatus
  location: string
  candidates_in_pipeline: number
  recruiter: string
  pipeline: PipelineCounts
}

export const MOCK_JOBS: MockJob[] = [
  {
    job_id: "job-01",
    title: "Senior Full-Stack Engineer",
    openings: 2,
    client_name: "Northwind Logistics",
    status: "open",
    location: "San Francisco, CA",
    candidates_in_pipeline: 8,
    recruiter: "Anna John",
    pipeline: { source: 8, screen: 6, interview: 4, offer: 2, close: 1 },
  },
  {
    job_id: "job-02",
    title: "Data Engineer",
    openings: 1,
    client_name: "Northwind Logistics",
    status: "open",
    location: "Remote (US)",
    candidates_in_pipeline: 5,
    recruiter: "Anna John",
    pipeline: { source: 5, screen: 4, interview: 2, offer: 1, close: 0 },
  },
  {
    job_id: "job-03",
    title: "Staff Backend Engineer",
    openings: 1,
    client_name: "Acme Fintech",
    status: "on_hold",
    location: "New York, NY",
    candidates_in_pipeline: 3,
    recruiter: "Diego Fernandez",
    pipeline: { source: 3, screen: 2, interview: 1, offer: 0, close: 0 },
  },
  {
    job_id: "job-04",
    title: "Product Manager, Growth",
    openings: 1,
    client_name: "Globex Media",
    status: "open",
    location: "Austin, TX",
    candidates_in_pipeline: 6,
    recruiter: "Priya Nair",
    pipeline: { source: 6, screen: 5, interview: 3, offer: 1, close: 1 },
  },
  {
    job_id: "job-05",
    title: "Engineering Manager, Platform",
    openings: 2,
    client_name: "Acme Fintech",
    status: "open",
    location: "New York, NY (Hybrid)",
    candidates_in_pipeline: 4,
    recruiter: "Diego Fernandez",
    pipeline: { source: 4, screen: 3, interview: 2, offer: 1, close: 0 },
  },
  {
    job_id: "job-06",
    title: "Senior ML Engineer",
    openings: 1,
    client_name: "Vertex Robotics",
    status: "open",
    location: "Remote (US)",
    candidates_in_pipeline: 7,
    recruiter: "Anna John",
    pipeline: { source: 7, screen: 5, interview: 3, offer: 2, close: 1 },
  },
  {
    job_id: "job-07",
    title: "DevOps Engineer",
    openings: 0,
    client_name: "Solstice Health",
    status: "filled",
    location: "Boston, MA",
    candidates_in_pipeline: 0,
    recruiter: "Priya Nair",
    pipeline: { source: 5, screen: 4, interview: 3, offer: 1, close: 1 },
  },
  {
    job_id: "job-08",
    title: "Frontend Engineer",
    openings: 0,
    client_name: "Meridian Freight",
    status: "closed",
    location: "Chicago, IL",
    candidates_in_pipeline: 0,
    recruiter: "Anna John",
    pipeline: { source: 4, screen: 2, interview: 1, offer: 0, close: 1 },
  },
  {
    job_id: "job-09",
    title: "Customer Success Manager",
    openings: 1,
    client_name: "Globex Media",
    status: "on_hold",
    location: "Remote (US)",
    candidates_in_pipeline: 2,
    recruiter: "Diego Fernandez",
    pipeline: { source: 2, screen: 2, interview: 1, offer: 0, close: 0 },
  },
  {
    job_id: "job-10",
    title: "Staff Data Scientist",
    openings: 3,
    client_name: "Vertex Robotics",
    status: "open",
    location: "Seattle, WA",
    candidates_in_pipeline: 5,
    recruiter: "Priya Nair",
    pipeline: { source: 5, screen: 4, interview: 2, offer: 1, close: 0 },
  },
  {
    job_id: "job-11",
    title: "Security Engineer",
    openings: 0,
    client_name: "Acme Fintech",
    status: "closed",
    location: "New York, NY",
    candidates_in_pipeline: 1,
    recruiter: "Anna John",
    pipeline: { source: 3, screen: 2, interview: 1, offer: 1, close: 1 },
  },
  {
    job_id: "job-12",
    title: "Support Engineer",
    openings: 0,
    client_name: "Northwind Logistics",
    status: "filled",
    location: "Remote (US)",
    candidates_in_pipeline: 0,
    recruiter: "Diego Fernandez",
    pipeline: { source: 2, screen: 2, interview: 1, offer: 1, close: 1 },
  },
  {
    job_id: "job-13",
    title: "Senior Product Designer",
    openings: 1,
    client_name: "Globex Media",
    status: "draft",
    location: "Remote (US)",
    candidates_in_pipeline: 0,
    recruiter: "Priya Nair",
    pipeline: { source: 0, screen: 0, interview: 0, offer: 0, close: 0 },
  },
]

/** Distinct client names, for the Add Job dialog's client picker. */
export const MOCK_JOB_CLIENTS: string[] = Array.from(
  new Set(MOCK_JOBS.map((j) => j.client_name))
).sort()
