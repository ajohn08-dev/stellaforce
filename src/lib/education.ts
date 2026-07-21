import type { CandidateEducationRow } from "@/lib/supabase/types"

/** Formats the candidate's primary (first) education entry as a single line, e.g. "MS, Computer Science at Cal Poly". */
export function formatEducationLine(
  entries: CandidateEducationRow[]
): string | null {
  const entry = entries[0]
  if (!entry) return null
  const degreeLine = [entry.degree, entry.field_of_study].filter(Boolean).join(", ")
  if (!degreeLine && !entry.institution_name) return null
  return [degreeLine, entry.institution_name && `at ${entry.institution_name}`]
    .filter(Boolean)
    .join(" ")
}
