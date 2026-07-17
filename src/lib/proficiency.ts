import type { ProficiencyLevel } from "@/lib/supabase/types"

export type ProficiencyTier = "low" | "medium" | "proficient"

const TIER_ORDER: ProficiencyTier[] = ["low", "medium", "proficient"]

/** Collapses the 5-level proficiency scale into the 3-tier Low/Medium/Proficient rating used by the Skill Map. */
export function proficiencyTier(
  level: ProficiencyLevel | null | undefined
): ProficiencyTier {
  switch (level) {
    case "advanced":
    case "expert":
      return "proficient"
    case "intermediate":
      return "medium"
    case "novice":
    case "beginner":
    default:
      return "low"
  }
}

/** The highest of a set of tiers — used to roll sub-skill tiers up into a category tier. */
export function maxTier(tiers: ProficiencyTier[]): ProficiencyTier {
  return tiers.reduce(
    (max, t) => (TIER_ORDER.indexOf(t) > TIER_ORDER.indexOf(max) ? t : max),
    "low" as ProficiencyTier
  )
}

export const PROFICIENCY_LABEL: Record<ProficiencyTier, string> = {
  low: "Low",
  medium: "Medium",
  proficient: "Proficient",
}

export const PROFICIENCY_BADGE_CLASS: Record<ProficiencyTier, string> = {
  low: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  medium: "bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200",
  proficient: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
}
