/**
 * Controlled vocabularies + display metadata. Mirror of the enums in
 * supabase/migrations/0001. CLAUDE.md is the source of truth — keep in sync.
 */
import type {
  ApplicationStatus,
  CandidateTier,
  ClientStatus,
  DataProvenance,
  JobStatus,
  NurtureStatus,
  PlacementStatus,
  ProficiencyLevel,
  SkillType,
} from "@/lib/supabase/types"

export const CANDIDATE_TIERS: CandidateTier[] = ["gold", "silver", "bronze"]

export const DATA_PROVENANCE: DataProvenance[] = [
  "ai_parsed",
  "recruiter_confirmed",
  "enriched",
]

export const SKILL_TYPES: SkillType[] = ["technical", "functional", "behavioral"]

export const PROFICIENCY_LEVELS: ProficiencyLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
]

export const CLIENT_STATUSES: ClientStatus[] = ["active", "paused", "churned"]

export const JOB_STATUSES: JobStatus[] = [
  "draft",
  "open",
  "paused",
  "filled",
  "closed",
]

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "active",
  "hired",
  "rejected",
  "withdrawn",
  "on_hold",
]

export const PLACEMENT_STATUSES: PlacementStatus[] = [
  "active",
  "completed",
  "fell_through",
]

export const NURTURE_STATUSES: NurtureStatus[] = [
  "active",
  "dormant",
  "re_engaging",
]

/**
 * Starter skill taxonomy. In production this becomes a managed table; for the
 * demo it seeds filters and validates AI-parsed skills against a known set.
 */
export const SKILL_TAXONOMY: string[] = [
  // Engineering
  "TypeScript",
  "JavaScript",
  "Python",
  "Go",
  "Rust",
  "Java",
  "Swift",
  "React",
  "Next.js",
  "Node.js",
  "PostgreSQL",
  "GraphQL",
  "AWS",
  "Kubernetes",
  "Terraform",
  // Data / AI
  "Machine Learning",
  "LLM Prompt Engineering",
  "RAG Systems",
  "Data Engineering",
  "SQL",
  "pandas",
  // Product / Design
  "Product Management",
  "UX Research",
  "Figma",
  "Design Systems",
  // Go-to-market
  "Sales",
  "Account Management",
  "Recruiting",
  "Technical Recruiting",
  // Soft skills
  "Communication",
  "Leadership",
  "Stakeholder Management",
  "Mentorship",
]

/**
 * Groups SKILL_TAXONOMY into display categories for the candidate profile's
 * Skill Map tab. Code-level only — not a DB concept, so a skill can move
 * categories without a migration.
 */
export const SKILL_CATEGORIES: Record<string, string[]> = {
  Engineering: [
    "TypeScript",
    "JavaScript",
    "Python",
    "Go",
    "Rust",
    "Java",
    "Swift",
    "React",
    "Next.js",
    "Node.js",
    "PostgreSQL",
    "GraphQL",
    "AWS",
    "Kubernetes",
    "Terraform",
  ],
  "Data & AI": [
    "Machine Learning",
    "LLM Prompt Engineering",
    "RAG Systems",
    "Data Engineering",
    "SQL",
    "pandas",
  ],
  "Product & Design": [
    "Product Management",
    "UX Research",
    "Figma",
    "Design Systems",
  ],
  "Go-to-Market": [
    "Sales",
    "Account Management",
    "Recruiting",
    "Technical Recruiting",
  ],
  "Soft Skills": [
    "Communication",
    "Leadership",
    "Stakeholder Management",
    "Mentorship",
  ],
}

/** Tailwind classes for tier badges (used across list + profile views). */
export const TIER_BADGE_CLASS: Record<CandidateTier, string> = {
  gold: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  silver: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-200",
  bronze: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
}

/** Tailwind classes for job status badges (used on the Jobs list). */
export const JOB_STATUS_BADGE_CLASS: Record<JobStatus, string> = {
  draft: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-200",
  open: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  paused: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  filled: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  closed: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-200",
}

/** Tailwind classes for workflow status badges (used on the Workflows list). */
export const WORKFLOW_STATUS_BADGE_CLASS: Record<"draft" | "published", string> = {
  draft: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-200",
  published: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
}

/** Human-readable labels for enum values that need prettifying. */
export function titleCase(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/**
 * Short human-readable date, e.g. "Mar 4, 2026" — used across list views.
 * Parses "YYYY-MM-DD" into local-time parts (not `new Date(string)`, which
 * treats a bare date as UTC midnight and can render a day early in
 * timezones behind UTC).
 */
export function formatDate(value: string): string {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/** Embedding dimension — must match vector(1536) in the schema. */
export const EMBEDDING_DIM = 1536

/**
 * Resume upload constraints — mirrors the `resumes` Storage bucket's
 * `allowed_mime_types` / `file_size_limit` (supabase/migrations). Enforced
 * client-side for immediate feedback; the bucket enforces them again
 * server-side as the source of truth.
 */
export const RESUME_ACCEPT = ".pdf,.doc,.docx"
export const RESUME_ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]
export const RESUME_MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
