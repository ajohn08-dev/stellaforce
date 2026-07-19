import type { CandidateRow, EducationEntry } from "@/lib/supabase/types"

/** Formats the candidate's primary (first) education entry as a single line, e.g. "MS, Computer Science at Cal Poly". */
export function formatEducationLine(
  education: CandidateRow["education"]
): string | null {
  const entries = Array.isArray(education) ? (education as EducationEntry[]) : []
  const entry = entries[0]
  if (!entry) return null
  const degreeLine = [entry.degree, entry.field_of_study].filter(Boolean).join(", ")
  if (!degreeLine && !entry.institution) return null
  return [degreeLine, entry.institution && `at ${entry.institution}`]
    .filter(Boolean)
    .join(" ")
}
