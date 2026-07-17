import { SKILL_CATEGORIES } from "@/lib/constants"
import { maxTier, proficiencyTier, type ProficiencyTier } from "@/lib/proficiency"
import type { SkillRow } from "@/lib/supabase/types"

export type CategorySkills = {
  category: string
  skills: SkillRow[]
  tier: ProficiencyTier
}

/** Groups a candidate's skills into SKILL_CATEGORIES, rating each category by its strongest skill. Categories with no matching skills are omitted. */
export function groupSkillsByCategory(skills: SkillRow[]): CategorySkills[] {
  const byName = new Map(skills.map((s) => [s.skill_name, s]))

  return Object.entries(SKILL_CATEGORIES)
    .map(([category, skillNames]) => {
      const matched = skillNames
        .map((name) => byName.get(name))
        .filter((s): s is SkillRow => Boolean(s))
      return {
        category,
        skills: matched,
        tier: maxTier(matched.map((s) => proficiencyTier(s.proficiency_level))),
      }
    })
    .filter((c) => c.skills.length > 0)
}
