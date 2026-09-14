import {
  currentRoleOf,
  readinessFor,
  reviewReasonsFor,
  sameReasons,
  ENRICHMENT_VERSION,
  REVIEW_REASON_LABELS,
  type ReadinessInput,
  type ReviewReason,
} from "../src/lib/candidate-readiness"
import { toCountryCode, countryLabel, COUNTRY_NAMES } from "../src/lib/country-normalization"

/**
 * Search-enrichment guard — `npm run enrichment-check`.
 *
 * Drives the real readiness rules, with no database and no network. The whole
 * point of this feature is that a candidate is properly searchable the moment
 * they are added, so the rules that decide "properly" have to be checkable
 * without standing up a candidate to check them against.
 *
 * No candidate data is read, and every fixture below is invented.
 */

let failures = 0
function check(ok: boolean, label: string, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

function section(title: string) {
  console.log(`\n${title}\n`)
}

/** A candidate with nothing wrong: classified, located, skilled, employed. */
const COMPLETE: ReadinessInput = {
  currentTitle: "Account Executive",
  canonicalRoleId: "role-uuid",
  locationCity: "Boston",
  locationCountry: "US",
  countryCode: "US",
  yearsExperience: 6,
  skillCount: 4,
  workExperiences: [
    { title: "Account Executive", isCurrent: true, displayOrder: 0, startDate: "2019-01-01" },
  ],
  currentResumeParseStatus: "parsed",
  overrideTitleChanged: false,
  now: new Date("2026-09-13T00:00:00Z"),
}

const reasons = (patch: Partial<ReadinessInput>) =>
  reviewReasonsFor({ ...COMPLETE, ...patch })

const has = (patch: Partial<ReadinessInput>, reason: ReviewReason) =>
  reasons(patch).includes(reason)

// ── The clean case ───────────────────────────────────────────────────────────

section("A complete candidate")

check(reasons({}).length === 0, "has no review reasons", reasons({}).join(", "))
check(readinessFor(reasons({})) === "ready", "is ready")
check(ENRICHMENT_VERSION >= 1, "enrichment version is set", `v${ENRICHMENT_VERSION}`)
check(
  Object.keys(REVIEW_REASON_LABELS).length === 10,
  "every reason code has recruiter-facing wording",
  `${Object.keys(REVIEW_REASON_LABELS).length} labels`
)

// ── Each reason in isolation ─────────────────────────────────────────────────

section("Review reasons")

check(has({ canonicalRoleId: null }, "unclassified_title"), "an unclassified title is flagged")
check(has({ overrideTitleChanged: true }, "override_title_changed"), "a stale recruiter override is flagged")
check(has({ locationCity: null }, "missing_location"), "a missing city is flagged")
check(has({ locationCity: "   " }, "missing_location"), "a blank city counts as missing")
check(has({ skillCount: 0 }, "no_skills"), "no skills is flagged")
check(has({ workExperiences: [] }, "no_work_experience"), "no work history is flagged")
check(
  has({ currentResumeParseStatus: "needs_review" }, "parse_needs_review"),
  "a résumé needing review is flagged"
)
check(
  has({ currentResumeParseStatus: "failed" }, "parse_needs_review"),
  "a failed parse is flagged as a parse problem"
)
check(
  !has({ currentResumeParseStatus: null }, "parse_needs_review"),
  "a candidate with no résumé at all is not flagged for parsing"
)

// A parse problem is a *reason*, never a readiness of `failed` — `failed` is
// reserved for our own reconciliation breaking.
check(
  readinessFor(reasons({ currentResumeParseStatus: "failed" })) === "ready_with_review",
  "a failed parse still reconciles to ready_with_review, never failed"
)

// ── Country ──────────────────────────────────────────────────────────────────

section("Country")

// The live data holds India as both "IN" and "India"; both must reach one code
// or "engineers in India" answers differently depending on which résumé it was.
check(toCountryCode("IN") === "IN" && toCountryCode("India") === "IN",
  "'IN' and 'India' both resolve to IN")
check(toCountryCode("india") === "IN" && toCountryCode("  India  ") === "IN",
  "case and whitespace do not matter")
check(
  toCountryCode("US") === "US" && toCountryCode("USA") === "US" &&
    toCountryCode("United States") === "US" && toCountryCode("U.S.") === "US",
  "the four common US spellings agree"
)
check(
  toCountryCode("UK") === "GB" && toCountryCode("United Kingdom") === "GB" &&
    toCountryCode("England") === "GB",
  "UK spellings resolve to GB"
)
check(toCountryCode(null) === null && toCountryCode("") === null && toCountryCode("   ") === null,
  "absent stays absent")
check(toCountryCode("Freedonia") === null && toCountryCode("ZZ") === null,
  "an unknown country resolves to null rather than a guess")
check(countryLabel("IN") === "India" && countryLabel("XX") === "XX",
  "labels fall back to the code")
check(
  Object.keys(COUNTRY_NAMES).every((c) => /^[A-Z]{2}$/.test(c)),
  "every supported code is a valid ISO-2 shape"
)

// The review reason fires only when a country is present and unrecognised.
check(has({ locationCountry: "Freedonia", countryCode: null }, "unresolved_country"),
  "an unrecognised country is flagged")
check(!has({ locationCountry: null, countryCode: null }, "unresolved_country"),
  "no country at all is not an unresolved country — missing_location already covers it")
check(!has({ locationCountry: "India", countryCode: "IN" }, "unresolved_country"),
  "a resolved country is not flagged")

// ── Two current roles ────────────────────────────────────────────────────────

section("Multiple current roles")

const TWO_CURRENT: ReadinessInput["workExperiences"] = [
  { title: "Account Executive", isCurrent: true, displayOrder: 0, startDate: "2019-01-01" },
  { title: "Advisor", isCurrent: true, displayOrder: 1, startDate: "2021-06-01" },
]
check(
  has({ workExperiences: TWO_CURRENT }, "multiple_current_roles"),
  "two current roles are flagged"
)
check(
  currentRoleOf(TWO_CURRENT)?.title === "Account Executive",
  "the tiebreak picks the lowest display order",
  currentRoleOf(TWO_CURRENT)?.title
)
check(
  currentRoleOf([]) === null && currentRoleOf([{ ...COMPLETE.workExperiences[0], isCurrent: false }]) === null,
  "no current role resolves to null rather than guessing"
)

// ── Title conflict ───────────────────────────────────────────────────────────

section("Title vs current role")

check(
  has(
    {
      currentTitle: "Account Executive",
      workExperiences: [
        { title: "Sales Engineer", isCurrent: true, displayOrder: 0, startDate: "2019-01-01" },
      ],
    },
    "title_conflicts_current_role"
  ),
  "a disagreement is flagged"
)
check(
  !has(
    {
      currentTitle: "  account   EXECUTIVE ",
      workExperiences: [
        { title: "Account Executive", isCurrent: true, displayOrder: 0, startDate: "2019-01-01" },
      ],
    },
    "title_conflicts_current_role"
  ),
  "case and spacing alone are not a conflict"
)
check(
  !has({ currentTitle: null }, "title_conflicts_current_role"),
  "a missing title is not a conflict"
)
check(
  !has({ workExperiences: [] }, "title_conflicts_current_role"),
  "no work history is not a conflict"
)

// ── Years: validated, never derived ──────────────────────────────────────────

section("Years of experience")

check(has({ yearsExperience: -2 }, "implausible_years"), "a negative figure is flagged")
check(has({ yearsExperience: 75 }, "implausible_years"), "an impossible figure is flagged")
check(!has({ yearsExperience: null }, "implausible_years"), "an absent figure is not implausible")
check(
  has({
    yearsExperience: 30,
    workExperiences: [
      { title: "Account Executive", isCurrent: true, displayOrder: 0, startDate: "2019-01-01" },
    ],
  }, "implausible_years"),
  "30 years against a career starting in 2019 is flagged"
)
check(
  !has({
    yearsExperience: 8,
    workExperiences: [
      { title: "Account Executive", isCurrent: true, displayOrder: 0, startDate: "2019-01-01" },
    ],
  }, "implausible_years"),
  "a year of slack is allowed for an omitted early job"
)
// The policy itself: this module reports, it does not compute a replacement.
check(
  reviewReasonsFor({ ...COMPLETE, yearsExperience: null }).length === 0,
  "a null years value is left alone, never derived from work history"
)

// ── Shape guarantees ─────────────────────────────────────────────────────────

section("Shape")

const messy = reasons({
  canonicalRoleId: null,
  locationCity: null,
  skillCount: 0,
  workExperiences: [],
})
check(messy.length === 4, "several problems produce several reasons", messy.join(", "))
check(
  JSON.stringify(messy) === JSON.stringify([...messy].sort()),
  "reasons come back sorted, so two identical states cannot differ by ordering"
)
check(new Set(messy).size === messy.length, "reasons are de-duplicated")
check(readinessFor(messy) === "ready_with_review", "any reason means ready_with_review")
check(sameReasons(messy, [...messy]), "sameReasons matches identical lists")
check(!sameReasons(messy, messy.slice(1)), "sameReasons rejects different lists")

// Readiness never returns pending or failed: those describe the *run*, not the
// candidate, and are set by the reconciler rather than by these rules.
check(
  ["ready", "ready_with_review"].includes(readinessFor([])) &&
    ["ready", "ready_with_review"].includes(readinessFor(messy)),
  "the rules only ever return ready or ready_with_review"
)

// ── Result ───────────────────────────────────────────────────────────────────

console.log(
  failures === 0
    ? "\nSearch enrichment: all checks passed\n"
    : `\nSearch enrichment: ${failures} check(s) failed\n`
)
process.exit(failures === 0 ? 0 : 1)
