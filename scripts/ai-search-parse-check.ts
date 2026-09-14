import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import {
  hasAnyAiFilter,
  sanitizeAiFilters,
  ROLE_FAMILY_OPTIONS,
  SENIORITY_OPTIONS,
  type RawAiFilters,
} from "../src/lib/candidate-search"

/**
 * AI search-parse guard — `npm run ai-search-check`.
 *
 * Covers the layer that runs *after* the model: `sanitizeAiFilters`, which is
 * what stops a parse from reaching a query with a role that doesn't exist, a
 * level that isn't in the enum, or a year range that is backwards. Pure — no
 * API key, no network, no database — because that is exactly the layer whose
 * job is to hold when the model misbehaves, and a test that needs the model to
 * misbehave on cue is a test that never runs.
 *
 * It does **not** test the model's judgement. Whether "senior AEs" comes back
 * as `account_executive` + `senior` is a prompt question, checked by hand
 * against the real API; what is checked here is that nothing the model can
 * return breaks the search.
 *
 * It also asserts the prompt and the enums stay tied to the seeded taxonomy,
 * which is the drift this design is most exposed to.
 */

let failures = 0
function check(ok: boolean, label: string, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

function section(title: string) {
  console.log(`\n${title}\n`)
}

/** The seeded role slugs, read from the migrations — the same source `title-check` uses. */
function seededRoleSlugs(): string[] {
  const dir = join(process.cwd(), "supabase/migrations")
  const slugs = new Set<string>()
  for (const file of readdirSync(dir)
    .filter((f) => /_seed_title_taxonomy.*\.sql$/.test(f))
    .sort()) {
    const sql = readFileSync(join(dir, file), "utf8")
    const split = sql.indexOf("from (values")
    for (const m of sql
      .slice(0, split === -1 ? undefined : split)
      .matchAll(/^\s*\('([a-z_]+)',\s*'([^']+)',\s*'([a-z_]+)'\),?\s*$/gm)) {
      slugs.add(m[1])
    }
  }
  return [...slugs]
}

const ROLES = seededRoleSlugs()

const EMPTY: RawAiFilters = {
  name: null,
  title: null,
  location: null,
  skills: [],
  minYears: null,
  maxYears: null,
  canonicalRoles: [],
  roleFamilies: [],
  seniorities: [],
  countries: [],
}

const clean = (patch: Partial<RawAiFilters>) =>
  sanitizeAiFilters({ ...EMPTY, ...patch }, ROLES)

// ── Vocabulary ───────────────────────────────────────────────────────────────

section("Vocabulary")
check(ROLES.length === 17, "17 seeded role slugs parsed from the migrations", `${ROLES.length}`)
check(ROLE_FAMILY_OPTIONS.length === 7, "7 role families", `${ROLE_FAMILY_OPTIONS.length}`)
check(SENIORITY_OPTIONS.length === 10, "10 seniority levels", `${SENIORITY_OPTIONS.length}`)
check(
  ROLE_FAMILY_OPTIONS.every(([, label]) => label.length > 0) &&
    SENIORITY_OPTIONS.every(([, label]) => label.length > 0),
  "every option has a friendly label"
)
// The three the brief named explicitly.
check(
  SENIORITY_OPTIONS.find(([v]) => v === "mid")?.[1] === "Mid-level" &&
    SENIORITY_OPTIONS.find(([v]) => v === "vp")?.[1] === "VP" &&
    SENIORITY_OPTIONS.find(([v]) => v === "c_level")?.[1] === "C-level",
  "mid / vp / c_level render as Mid-level / VP / C-level"
)

// ── Role slugs ───────────────────────────────────────────────────────────────

section("Role slugs")

check(
  clean({ canonicalRoles: ["account_executive"] }).roleSlugs.join() === "account_executive",
  "a seeded slug survives"
)
check(
  clean({ canonicalRoles: ["account_executive", "channel_partner_sales"] }).roleSlugs.length === 2,
  "several roles survive together (OR within the group)"
)
check(
  clean({ canonicalRoles: ["not_a_real_role"] }).roleSlugs.length === 0,
  "an invented slug is dropped"
)
check(
  clean({ canonicalRoles: ["account_executive", "not_a_real_role"] }).roleSlugs.join() ===
    "account_executive",
  "a mixed list keeps the valid slug and drops the rest"
)
check(
  clean({ canonicalRoles: ["ACCOUNT_EXECUTIVE", " account_executive "] }).roleSlugs.join() ===
    "account_executive",
  "case and whitespace are normalized, duplicates collapse"
)
// The defence that does not depend on the output schema being honoured.
check(
  sanitizeAiFilters({ ...EMPTY, canonicalRoles: ["account_executive"] }, []).roleSlugs.length === 0,
  "with an empty taxonomy every role is dropped, never passed through"
)

// ── Enum groups ──────────────────────────────────────────────────────────────

section("Families and seniority")

check(clean({ roleFamilies: ["sales"] }).roleFamilies.join() === "sales", "a valid family survives")
check(clean({ roleFamilies: ["bogus"] }).roleFamilies.length === 0, "an invalid family is dropped")
check(
  clean({ roleFamilies: ["sales", "bogus", "engineering"] }).roleFamilies.join() ===
    "sales,engineering",
  "a mixed family list keeps only the valid values"
)
check(
  clean({ seniorities: ["senior", "director"] }).seniorities.join() === "senior,director",
  "several levels survive together (OR within the group)"
)
check(
  clean({ seniorities: ["wizard", "senior"] }).seniorities.join() === "senior",
  "an invented level is dropped"
)
check(
  clean({ seniorities: ["C_LEVEL"] }).seniorities.join() === "c_level",
  "level casing is normalized"
)

// ── Years ────────────────────────────────────────────────────────────────────

section("Years")

check(clean({ minYears: 5 }).minYears === 5, "a sensible minimum survives")
check(clean({ minYears: -3 }).minYears === null, "a negative minimum is dropped")
check(clean({ maxYears: -1 }).maxYears === null, "a negative maximum is dropped")
const inverted = clean({ minYears: 8, maxYears: 3 })
check(
  inverted.minYears === null && inverted.maxYears === null,
  "an inverted range is dropped entirely rather than half-applied"
)
const range = clean({ minYears: 3, maxYears: 8 })
check(range.minYears === 3 && range.maxYears === 8, "a valid range survives")

// ── Text fields ──────────────────────────────────────────────────────────────

section("Text fields")

check(clean({ title: "  Enterprise  " }).title === "Enterprise", "title is trimmed")
check(clean({ title: "   " }).title === null, "a whitespace-only title becomes null")
check(
  clean({ skills: [" Salesforce ", "", "Outreach"] }).skills.join() === "Salesforce,Outreach",
  "skills are trimmed and blanks dropped"
)
// The raw title text is a free-text filter and must survive verbatim — it is
// how a market qualifier like "Enterprise" is honoured at all.
check(
  clean({ canonicalRoles: ["account_executive"], title: "Enterprise" }).title === "Enterprise",
  "a role and a title qualifier coexist (role AND title text)"
)

// ── Emptiness ────────────────────────────────────────────────────────────────

section("Empty parses")

check(!hasAnyAiFilter(clean({})), "a parse with nothing in it has no filters")
check(
  !hasAnyAiFilter(clean({ canonicalRoles: ["not_a_real_role"] })),
  "a parse whose only filter was an invalid role counts as empty — never an unfiltered search"
)
check(
  hasAnyAiFilter(clean({ canonicalRoles: ["account_executive"] })),
  "a role-only parse is a real search"
)
check(hasAnyAiFilter(clean({ roleFamilies: ["sales"] })), "a family-only parse is a real search")
check(hasAnyAiFilter(clean({ seniorities: ["senior"] })), "a seniority-only parse is a real search")

// ── Prompt/schema wiring ─────────────────────────────────────────────────────
//
// Read as text rather than imported: the parser module is `server-only`.

section("Prompt and schema wiring")

const parserSource = readFileSync(
  join(process.cwd(), "src/lib/ai/candidate-search-parse.ts"),
  "utf8"
)

check(
  parserSource.includes("ROLE_FAMILY_OPTIONS") && parserSource.includes("SENIORITY_OPTIONS"),
  "the parser's enums come from the shared option lists, not a second copy"
)
check(
  !parserSource.includes("do NOT expand abbreviations into a canonical title"),
  "the pre-taxonomy instruction forbidding canonical roles is gone"
)
check(
  parserSource.includes("canonicalRoles") &&
    parserSource.includes("roleFamilies") &&
    parserSource.includes("seniorities"),
  "the schema carries all three normalized groups"
)
check(
  parserSource.includes("buildSearchSchema(roles"),
  "the role enum is built from the live taxonomy, not hardcoded"
)
check(
  !/z\.enum\(\[\s*"account_executive"/.test(parserSource),
  "no role slug list is hardcoded in the parser"
)

// ── Result ───────────────────────────────────────────────────────────────────

console.log(
  failures === 0
    ? "\nAI search parse: all checks passed\n"
    : `\nAI search parse: ${failures} check(s) failed\n`
)
process.exit(failures === 0 ? 0 : 1)
