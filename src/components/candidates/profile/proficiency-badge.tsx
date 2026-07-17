import {
  PROFICIENCY_BADGE_CLASS,
  PROFICIENCY_LABEL,
  type ProficiencyTier,
} from "@/lib/proficiency"

export function ProficiencyBadge({ tier }: { tier: ProficiencyTier }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PROFICIENCY_BADGE_CLASS[tier]}`}
    >
      {PROFICIENCY_LABEL[tier]}
    </span>
  )
}
