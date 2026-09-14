import type { SearchReadiness } from "@/lib/supabase/types"

/**
 * What makes a candidate properly searchable — the rules, as pure functions.
 *
 * Free of `server-only` and of any Supabase import (the type-only import above
 * is erased at build time), like `candidate-search.ts` and
 * `title-normalization.ts` before it, so `npm run enrichment-check` drives the
 * real rules headless rather than a copy of them.
 *
 * ## These rules never hide anyone
 *
 * **Every candidate is searchable, always.** Name, raw title text, city, skills
 * and years reach every row in the table regardless of anything computed here.
 * What this module produces is a list of things a human might want to fix, and
 * a one-word summary of that list. The only thing that decides whether the
 * *normalized* role filters can match someone is whether they have a
 * classification — which is `candidates.canonical_role_id`, not a flag.
 *
 * ## These rules only ever report
 *
 * Nothing here rewrites a candidate. Years of experience are checked for
 * plausibility and never derived; a location is checked for presence and never
 * normalized; a title that disagrees with the current work-experience row is
 * flagged and never reconciled. Each of those is a decision a person has to
 * make, and a computed answer would be confidently wrong often enough to be
 * worse than a question.
 */

/**
 * Bump when the rules change meaning — a new reason, a changed threshold, a
 * fixed bug. Every row below this version is re-reconciled by the sweep, which
 * is how a rule change reaches candidates without a migration or a backfill.
 */
export const ENRICHMENT_VERSION = 2

/** Stable machine codes. Stored in `candidate_search_state.review_reasons`. */
export type ReviewReason =
  /** No deterministic rule matched the current title, so role filters can't reach them. */
  | "unclassified_title"
  /** A recruiter classified this, and the raw title has since changed. */
  | "override_title_changed"
  | "missing_location"
  | "no_skills"
  | "no_work_experience"
  /** Two or more work-experience rows claim to be current. */
  | "multiple_current_roles"
  /** `candidates.current_title` disagrees with the current work-experience row. */
  | "title_conflicts_current_role"
  | "implausible_years"
  /** The current résumé parsed badly — a parse problem, not a reconciliation one. */
  | "parse_needs_review"
  /** A country is on file but no rule recognised it, so country search can't reach them. */
  | "unresolved_country"

/** Recruiter-facing wording. One sentence, no jargon, no blame. */
export const REVIEW_REASON_LABELS: Record<ReviewReason, string> = {
  unclassified_title: "Title isn't classified yet, so role filters won't find them",
  override_title_changed: "Their title changed after you classified them",
  missing_location: "No city on file",
  no_skills: "No skills recorded",
  no_work_experience: "No work history on file",
  multiple_current_roles: "Two roles are both marked current",
  title_conflicts_current_role: "Current title doesn't match their current role",
  implausible_years: "Years of experience looks wrong",
  parse_needs_review: "Their résumé needs a second look",
  unresolved_country: "We couldn't match their country, so country filters won't find them",
}

/** Everything the rules need. Loaded once by the reconciler. */
export type ReadinessInput = {
  currentTitle: string | null
  canonicalRoleId: string | null
  locationCity: string | null
  /** The raw `location_country`, exactly as parsed. */
  locationCountry: string | null
  /** The resolved ISO-2, or null when the raw value matched no rule. */
  countryCode: string | null
  yearsExperience: number | null
  skillCount: number
  workExperiences: ReadonlyArray<{
    title: string
    isCurrent: boolean
    displayOrder: number
    startDate: string | null
  }>
  /** `parse_status` of the current résumé, or null when there is no résumé. */
  currentResumeParseStatus: string | null
  /** True when the normalizer preserved a recruiter override against a changed title. */
  overrideTitleChanged: boolean
  /** Injected so the guard can pin it; defaults to now. */
  now?: Date
}

/** Nobody has a 60-year career, and a parse that says so mis-read a date. */
const MAX_PLAUSIBLE_YEARS = 60

/** Formatting only — the same comparison `title-normalization.ts` uses for matching. */
function loose(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim()
}

/**
 * The work-experience row that represents "now": the current one with the
 * lowest display order, falling back to the latest start date. Used for the
 * conflict check and nothing else — it never becomes a stored value.
 */
export function currentRoleOf(
  experiences: ReadinessInput["workExperiences"]
): ReadinessInput["workExperiences"][number] | null {
  const current = experiences.filter((e) => e.isCurrent)
  if (current.length === 0) return null
  return [...current].sort(
    (a, b) =>
      a.displayOrder - b.displayOrder ||
      (b.startDate ?? "").localeCompare(a.startDate ?? "")
  )[0]
}

/**
 * Years of experience is **validated, never derived.**
 *
 * Deriving it from work history sounds obvious and is a trap: parsed résumés
 * carry gaps, overlaps and missing end dates, so a computed figure is
 * confidently wrong often enough to be worse than a blank — and it would
 * silently overwrite a number a recruiter typed. So the only question asked
 * here is whether the stored value could possibly be true.
 */
function yearsLookWrong(input: ReadinessInput): boolean {
  const years = input.yearsExperience
  if (years === null) return false // absent is not implausible
  if (years < 0 || years > MAX_PLAUSIBLE_YEARS) return true

  const starts = input.workExperiences
    .map((e) => e.startDate)
    .filter((d): d is string => !!d)
    .sort()
  if (starts.length === 0) return false

  const earliest = new Date(starts[0])
  if (Number.isNaN(earliest.getTime())) return false

  const now = input.now ?? new Date()
  const careerYears =
    (now.getTime() - earliest.getTime()) / (365.25 * 24 * 60 * 60 * 1000)

  // One year of slack: a résumé that omits an early job, or a career that
  // started mid-year, should not be flagged.
  return years > careerYears + 1
}

/**
 * Every reason this candidate's search data is less than complete.
 *
 * Sorted and de-duplicated, so two identical states can never differ by
 * ordering — which is what lets the reconciler compare cheaply and write
 * nothing when nothing changed.
 */
export function reviewReasonsFor(input: ReadinessInput): ReviewReason[] {
  const reasons = new Set<ReviewReason>()

  // The one that matters most for search: without a classification, none of the
  // role, family or seniority filters can reach this person.
  if (!input.canonicalRoleId) reasons.add("unclassified_title")

  // Louder than the rest, and separate: a stored classification is knowingly out
  // of step with the title sitting next to it, and only a human can say whether
  // it still holds.
  if (input.overrideTitleChanged) reasons.add("override_title_changed")

  if (!input.locationCity?.trim()) reasons.add("missing_location")

  // Only when a country was recorded and could not be resolved. An absent
  // country is already covered by `missing_location`, and flagging it twice
  // would make one gap look like two.
  if (input.locationCountry?.trim() && !input.countryCode) {
    reasons.add("unresolved_country")
  }
  if (input.skillCount <= 0) reasons.add("no_skills")
  if (input.workExperiences.length === 0) reasons.add("no_work_experience")

  if (input.workExperiences.filter((e) => e.isCurrent).length > 1) {
    reasons.add("multiple_current_roles")
  }

  const currentRole = currentRoleOf(input.workExperiences)
  if (
    input.currentTitle?.trim() &&
    currentRole?.title?.trim() &&
    loose(input.currentTitle) !== loose(currentRole.title)
  ) {
    // Reported, never reconciled: the two fields mean different things, and
    // picking a winner would overwrite one recruiter-entered fact with another
    // machine-parsed one.
    reasons.add("title_conflicts_current_role")
  }

  if (yearsLookWrong(input)) reasons.add("implausible_years")

  if (
    input.currentResumeParseStatus === "needs_review" ||
    input.currentResumeParseStatus === "failed"
  ) {
    // Deliberately a *reason*, not a `failed` readiness: the parse is what went
    // wrong. Conflating it with our own failures makes both unreadable.
    reasons.add("parse_needs_review")
  }

  return [...reasons].sort()
}

/**
 * The one-word summary of that list.
 *
 * Only two outcomes are reachable from here — a run that completed either found
 * something worth a human's time or it didn't. `pending` means no run has
 * happened yet and `failed` means the run itself broke; neither is a property
 * of the candidate, so neither is decided by these rules.
 */
export function readinessFor(reasons: readonly ReviewReason[]): SearchReadiness {
  return reasons.length === 0 ? "ready" : "ready_with_review"
}

/** True when two reason lists say the same thing. Both must already be sorted. */
export function sameReasons(
  a: readonly string[],
  b: readonly string[]
): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i])
}
