import type { CandidateTier } from "@/lib/supabase/types"
import type { MockJob, PipelineCounts } from "@/lib/mock-jobs"

export type StageKey = keyof PipelineCounts

/** Fixed 5-stage funnel used across the Jobs list cards and the job workspace board. */
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
  stage: StageKey,
  index: number
): PipelineCandidate {
  const seed = hash(`${jobId}:${stage}:${index}`)
  const first = FIRST_NAMES[seed % FIRST_NAMES.length]
  const last = LAST_NAMES[Math.floor(seed / FIRST_NAMES.length) % LAST_NAMES.length]
  const tier = TIERS[seed % TIERS.length]
  const days_in_stage = 1 + (seed % 14)

  return {
    candidate_id: `${jobId}-${stage}-${index}`,
    full_name: `${first} ${last}`,
    tier,
    days_in_stage,
  }
}

/**
 * Expands a job's per-stage headcounts (src/lib/mock-jobs.ts) into named
 * candidate stubs for the job workspace board. Derived rather than
 * hand-authored so the counts shown on the Jobs list and the board always
 * agree — there's one source of truth (`job.pipeline`).
 */
export function getPipelineCandidates(
  job: MockJob
): Record<StageKey, PipelineCandidate[]> {
  const result = {} as Record<StageKey, PipelineCandidate[]>
  for (const { key } of PIPELINE_STAGES) {
    const count = job.pipeline[key]
    result[key] = Array.from({ length: count }, (_, i) =>
      pseudoCandidate(job.job_id, key, i)
    )
  }
  return result
}
