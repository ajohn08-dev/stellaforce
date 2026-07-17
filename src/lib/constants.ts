/**
 * Controlled vocabularies + display metadata. Mirror of the enums in
 * supabase/migrations/0001. CLAUDE.md is the source of truth — keep in sync.
 */
import type {
  ApplicationStage,
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

export const SKILL_TYPES: SkillType[] = ["hard", "soft"]

export const PROFICIENCY_LEVELS: ProficiencyLevel[] = [
  "novice",
  "beginner",
  "intermediate",
  "advanced",
  "expert",
]

export const CLIENT_STATUSES: ClientStatus[] = ["active", "paused", "churned"]

export const JOB_STATUSES: JobStatus[] = ["open", "on_hold", "filled", "closed"]

export const APPLICATION_STAGES: ApplicationStage[] = [
  "sourced",
  "screened",
  "submitted",
  "interviewing",
  "offer",
  "placed",
  "rejected",
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

/** Human-readable labels for enum values that need prettifying. */
export function titleCase(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/** Embedding dimension — must match vector(1536) in the schema. */
export const EMBEDDING_DIM = 1536
