import { ProficiencyBadge } from "@/components/candidates/profile/proficiency-badge"
import { proficiencyTier } from "@/lib/proficiency"
import { groupSkillsByCategory } from "@/lib/skill-categories"
import type { SkillRow } from "@/lib/supabase/types"

export function SkillMapTab({ skills }: { skills: SkillRow[] }) {
  const categories = groupSkillsByCategory(skills)

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">No skills recorded.</p>
  }

  return (
    <div className="space-y-4">
      {categories.map(({ category, skills: categorySkills, tier }) => (
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
      ))}
    </div>
  )
}
