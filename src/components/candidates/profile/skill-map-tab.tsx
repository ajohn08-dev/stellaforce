import { SKILL_CATEGORIES } from "@/lib/constants"
import {
  maxTier,
  proficiencyTier,
  PROFICIENCY_BADGE_CLASS,
  PROFICIENCY_LABEL,
  type ProficiencyTier,
} from "@/lib/proficiency"
import type { SkillRow } from "@/lib/supabase/types"

export function SkillMapTab({ skills }: { skills: SkillRow[] }) {
  const byName = new Map(skills.map((s) => [s.skill_name, s]))

  const categories = Object.entries(SKILL_CATEGORIES)
    .map(([category, skillNames]) => ({
      category,
      skills: skillNames
        .map((name) => byName.get(name))
        .filter((s): s is SkillRow => Boolean(s)),
    }))
    .filter((c) => c.skills.length > 0)

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">No skills recorded.</p>
  }

  return (
    <div className="space-y-4">
      {categories.map(({ category, skills: categorySkills }) => {
        const tier = maxTier(
          categorySkills.map((s) => proficiencyTier(s.proficiency_level))
        )
        return (
          <div key={category} className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{category}</h3>
              <ProficiencyBadge tier={tier} />
            </div>
            <div className="mt-3 space-y-2">
              {categorySkills.map((s) => (
                <div
                  key={s.skill_id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-sm text-muted-foreground">
                    {s.skill_name}
                  </span>
                  <ProficiencyBadge tier={proficiencyTier(s.proficiency_level)} />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ProficiencyBadge({ tier }: { tier: ProficiencyTier }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PROFICIENCY_BADGE_CLASS[tier]}`}
    >
      {PROFICIENCY_LABEL[tier]}
    </span>
  )
}
