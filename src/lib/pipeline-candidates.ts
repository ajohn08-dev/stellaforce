import { SKILL_TAXONOMY } from "@/lib/constants"
import type { CandidateTier } from "@/lib/supabase/types"
import type { MockJob, PipelineCounts } from "@/lib/mock-jobs"

export type StageKey = keyof PipelineCounts

/** Fixed 5-stage funnel used across the Jobs list cards (aggregate counts only). */
export const PIPELINE_STAGES: { key: StageKey; label: string }[] = [
  { key: "source", label: "source" },
  { key: "screen", label: "screen" },
  { key: "interview", label: "interview" },
  { key: "offer", label: "offer" },
  { key: "close", label: "close" },
]

export type PipelineCandidate = {
  candidate_id: string
  full_name: string
  tier: CandidateTier
  days_in_stage: number
  title: string
  company: string
  location: string
  summary: string
  skills: string[]
  email: string
  phone: string
  linkedin_url: string
  github_url: string
}

const FIRST_NAMES = [
  "Ava", "Liam", "Noah", "Emma", "Oliver", "Mia", "Ethan", "Sophia",
  "Lucas", "Isabella", "Mason", "Amelia", "Elijah", "Harper", "Aiden",
  "Evelyn", "Grayson", "Layla", "Owen", "Chloe", "Wyatt", "Nora",
  "Julian", "Zoe",
]

const LAST_NAMES = [
  "Bennett", "Carter", "Diaz", "Ellis", "Foster", "Grant", "Hayes",
  "Ibrahim", "Jensen", "Kwan", "Lopez", "Mercer", "Nakamura", "Osei",
  "Patel", "Quinn", "Reyes", "Silva", "Tran", "Ueda", "Vasquez",
  "Whitfield", "Yamamoto", "Zimmer",
]

const TIERS: CandidateTier[] = ["gold", "silver", "bronze"]

const TITLES = [
  "Software Engineer", "Senior Software Engineer", "Product Manager",
  "Data Scientist", "Data Engineer", "Engineering Manager",
  "DevOps Engineer", "Frontend Engineer", "Backend Engineer",
  "Machine Learning Engineer", "Security Engineer", "Support Engineer",
]

const COMPANIES = [
  "Apple", "Google", "Meta", "Tesla", "NVIDIA", "Uber", "Vertex Labs",
  "Brightline Software", "PixelForge", "Northwind Studio", "Dolby Laboratories",
]

const LOCATIONS = [
  "San Francisco, CA", "San Jose, CA", "Austin, TX", "Seattle, WA",
  "New York, NY", "Boston, MA", "Chicago, IL", "Denver, CO",
  "Remote (US)", "Los Angeles, CA",
]

function pick<T>(pool: T[], seed: number): T {
  return pool[seed % pool.length]
}

/** Deterministic string hash — same (job, stage, index) always yields the same fake candidate. */
function hash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(h, 31) + input.charCodeAt(i)) >>> 0
  }
  return h
}

function pseudoCandidate(
  jobId: string,
  stage: string,
  index: number
): PipelineCandidate {
  const seed = hash(`${jobId}:${stage}:${index}`)
  const first = FIRST_NAMES[seed % FIRST_NAMES.length]
  const last = LAST_NAMES[Math.floor(seed / FIRST_NAMES.length) % LAST_NAMES.length]
  const tier = TIERS[seed % TIERS.length]
  const days_in_stage = 1 + (seed % 14)
  const title = pick(TITLES, seed)
  const company = pick(COMPANIES, seed >> 2)
  const location = pick(LOCATIONS, seed >> 4)
  const skills = [
    SKILL_TAXONOMY[seed % SKILL_TAXONOMY.length],
    SKILL_TAXONOMY[(seed >> 3) % SKILL_TAXONOMY.length],
    SKILL_TAXONOMY[(seed >> 6) % SKILL_TAXONOMY.length],
  ].filter((skill, i, arr) => arr.indexOf(skill) === i)
  const handle = `${first}${last}`.toLowerCase()
  const phoneDigits = String(1000 + (seed % 9000))

  return {
    candidate_id: `${jobId}-${stage}-${index}`,
    full_name: `${first} ${last}`,
    tier,
    days_in_stage,
    title,
    company,
    location,
    summary: `${title} at ${company}, based in ${location}.`,
    skills,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    phone: `+1-408-555-${phoneDigits}`,
    linkedin_url: `https://linkedin.com/in/${handle}`,
    github_url: `https://github.com/${handle}`,
  }
}

/**
 * Per-job breakdown of each of the 5 pipeline groups into the recruiter's
 * actual named sub-stages, for the job workspace board. Varies by role —
 * an engineering req gets technical interview rounds, a GTM req gets panel/
 * case-study rounds, etc. Jobs not listed fall back to DEFAULT_SUB_STAGES.
 */
const SUB_STAGE_NAMES: Record<string, Record<StageKey, string[]>> = {
  "job-01": {
    // Senior Full-Stack Engineer — Northwind Logistics
    source: ["Source"],
    screen: ["Recruiter Screen", "HR Screening"],
    interview: [
      "Hiring Manager Interview",
      "Technical Interview 1",
      "Technical Interview 2",
      "Interview: Behavioral Round with CTO",
    ],
    offer: ["Offer"],
    close: ["Close"],
  },
  "job-02": {
    // Data Engineer — Northwind Logistics
    source: ["Source"],
    screen: ["Recruiter Screen"],
    interview: [
      "Technical Screen",
      "System Design Interview",
      "Hiring Manager Interview",
    ],
    offer: ["Offer"],
    close: ["Close"],
  },
  "job-03": {
    // Staff Backend Engineer — Acme Fintech
    source: ["Source"],
    screen: ["Recruiter Screen", "Technical Phone Screen"],
    interview: [
      "System Design Interview",
      "Coding Interview",
      "Hiring Manager Interview",
    ],
    offer: ["Offer"],
    close: ["Close"],
  },
  "job-04": {
    // Product Manager, Growth — Globex Media
    source: ["Source"],
    screen: ["Recruiter Screen"],
    interview: [
      "Case Study Interview",
      "Cross-Functional Panel",
      "Final Interview with VP Product",
    ],
    offer: ["Offer"],
    close: ["Close"],
  },
  "job-05": {
    // Engineering Manager, Platform — Acme Fintech
    source: ["Source"],
    screen: ["Recruiter Screen", "HR Screening"],
    interview: [
      "Technical Deep Dive",
      "Leadership Interview",
      "Panel Interview",
      "Final Interview with CTO",
    ],
    offer: ["Offer"],
    close: ["Close"],
  },
  "job-06": {
    // Senior ML Engineer — Vertex Robotics
    source: ["Source"],
    screen: ["Recruiter Screen"],
    interview: [
      "ML Systems Interview",
      "Coding Interview",
      "Hiring Manager Interview",
    ],
    offer: ["Offer"],
    close: ["Close"],
  },
  "job-07": {
    // DevOps Engineer — Solstice Health
    source: ["Source"],
    screen: ["Recruiter Screen"],
    interview: ["Technical Interview", "Hiring Manager Interview"],
    offer: ["Offer"],
    close: ["Close"],
  },
  "job-08": {
    // Frontend Engineer — Meridian Freight
    source: ["Source"],
    screen: ["Recruiter Screen"],
    interview: [
      "Technical Interview",
      "Take-Home Review",
      "Hiring Manager Interview",
    ],
    offer: ["Offer"],
    close: ["Close"],
  },
  "job-09": {
    // Customer Success Manager — Globex Media
    source: ["Source"],
    screen: ["Recruiter Screen"],
    interview: ["Roleplay Interview", "Hiring Manager Interview"],
    offer: ["Offer"],
    close: ["Close"],
  },
  "job-10": {
    // Staff Data Scientist — Vertex Robotics
    source: ["Source"],
    screen: ["Recruiter Screen", "Technical Screen"],
    interview: [
      "Case Study Interview",
      "Statistics Interview",
      "Hiring Manager Interview",
    ],
    offer: ["Offer"],
    close: ["Close"],
  },
  "job-11": {
    // Security Engineer — Acme Fintech
    source: ["Source"],
    screen: ["Recruiter Screen"],
    interview: ["Security Technical Interview", "Hiring Manager Interview"],
    offer: ["Offer"],
    close: ["Close"],
  },
  "job-12": {
    // Support Engineer — Northwind Logistics
    source: ["Source"],
    screen: ["Recruiter Screen"],
    interview: ["Technical Interview", "Hiring Manager Interview"],
    offer: ["Offer"],
    close: ["Close"],
  },
}

const DEFAULT_SUB_STAGE_NAMES: Record<StageKey, string[]> = {
  source: ["Source"],
  screen: ["Recruiter Screen"],
  interview: ["Interview"],
  offer: ["Offer"],
  close: ["Close"],
}

/** Splits `total` across `buckets` slots as evenly as possible — earlier slots absorb the remainder. */
function splitCount(total: number, buckets: number): number[] {
  const base = Math.floor(total / buckets)
  const remainder = total % buckets
  return Array.from({ length: buckets }, (_, i) => base + (i < remainder ? 1 : 0))
}

export type SubStage = {
  key: string
  name: string
  group: StageKey
  candidates: PipelineCandidate[]
}

/**
 * Flattens a job's 5 pipeline groups into its actual named sub-stages (e.g.
 * "screen" -> "Recruiter Screen" + "HR Screening") for the workspace tab
 * board, splitting each group's aggregate headcount across its sub-stages
 * so totals still agree with `job.pipeline` / the Jobs list card summary.
 */
export function getSubStageBoard(job: MockJob): SubStage[] {
  const namesByGroup = SUB_STAGE_NAMES[job.job_id] ?? DEFAULT_SUB_STAGE_NAMES
  const board: SubStage[] = []

  for (const { key: group } of PIPELINE_STAGES) {
    const names = namesByGroup[group]
    const counts = splitCount(job.pipeline[group], names.length)

    names.forEach((name, i) => {
      board.push({
        key: `${group}-${i}`,
        name,
        group,
        candidates: Array.from({ length: counts[i] }, (_, j) =>
          pseudoCandidate(job.job_id, `${group}:${name}`, j)
        ),
      })
    })
  }

  return board
}
