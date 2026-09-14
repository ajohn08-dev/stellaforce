import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import {
  classifyTitle,
  decideNormalization,
  type TitleAliasRule,
} from "../src/lib/title-normalization"

/**
 * Title normalization guard — `npm run title-check`.
 *
 * Drives the real `classifyTitle` / `decideNormalization`, never a
 * re-implementation of them, and never touches the database: the alias fixture
 * is parsed out of the seed migration itself. That is deliberate. A hand-typed
 * fixture would pass forever while the seeded rules drifted underneath it, and
 * the two things this feature can get catastrophically wrong — a substring
 * match putting the wrong person in a result, and a rule quietly disagreeing
 * with what is actually in the database — both live in exactly that gap.
 *
 * No candidate data is read, printed, or required.
 */

const MIGRATIONS = join(process.cwd(), "supabase/migrations")

/**
 * Every taxonomy seed, oldest first — the original and each forward-only
 * coverage pass. Discovered rather than listed, so a new seed migration is
 * covered by this guard the moment it lands instead of when someone remembers
 * to add it here.
 */
function seedFiles(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((f) => /_seed_title_taxonomy.*\.sql$/.test(f))
    .sort()
    .map((f) => join(MIGRATIONS, f))
}

let failures = 0
function check(ok: boolean, label: string, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

function section(title: string) {
  console.log(`\n${title}\n`)
}

// ── Build the rule fixture from the seed migration ───────────────────────────

type SeededRole = { slug: string; label: string; family: string }

function parseSeed(): { roles: SeededRole[]; aliases: TitleAliasRule[] } {
  const files = seedFiles()
  if (files.length === 0) throw new Error("no title taxonomy seed migration found")

  const roleBySlug = new Map<string, SeededRole>()
  const ruleByAlias = new Map<string, TitleAliasRule>()

  for (const file of files) {
    const sql = readFileSync(file, "utf8")

    // Each seed has exactly two VALUES blocks: roles, then aliases.
    // `from (values` starts the second one, which separates the two shapes.
    const split = sql.indexOf("from (values")
    if (split === -1) throw new Error(`seed shape changed in ${file}: no alias VALUES block`)

    for (const m of sql
      .slice(0, split)
      .matchAll(/^\s*\('([a-z_]+)',\s*'([^']+)',\s*'([a-z_]+)'\),?\s*$/gm)) {
      roleBySlug.set(m[1], { slug: m[1], label: m[2], family: m[3] })
    }

    for (const m of sql
      .slice(split)
      .matchAll(
        /^\s*\('([^']+)',\s*(?:'([a-z_]+)'|null),\s*(?:'([a-z_]+)'|null::text),\s*(true|false)\),?\s*$/gm
      )) {
      const slug = m[2] ?? null
      // Later seeds win, exactly as `on conflict (lower(alias)) do update` does
      // in the database.
      ruleByAlias.set(m[1].toLowerCase(), {
        alias: m[1],
        // The real column is a uuid; the pure module only passes it through, so
        // a synthetic stable id is enough here and keeps the fixture readable.
        canonicalRoleId: slug ? `role:${slug}` : null,
        canonicalRoleSlug: slug,
        roleFamily: null as TitleAliasRule["roleFamily"],
        impliedSeniority: (m[3] ?? null) as TitleAliasRule["impliedSeniority"],
        isAmbiguous: m[4] === "true",
      })
    }
  }

  // Families are resolved after every file is read, so an alias in one seed can
  // reference a role introduced by another.
  const aliases = [...ruleByAlias.values()].map((rule) => ({
    ...rule,
    roleFamily: (rule.canonicalRoleSlug
      ? roleBySlug.get(rule.canonicalRoleSlug)?.family ?? null
      : null) as TitleAliasRule["roleFamily"],
  }))

  return { roles: [...roleBySlug.values()], aliases }
}

const { roles, aliases } = parseSeed()

section("Seed fixture")
check(roles.length === 17, "17 canonical roles parsed from the seeds", `${roles.length}`)
check(aliases.length >= 49, "alias rules parsed from the seeds", `${aliases.length}`)
check(
  seedFiles().length >= 2,
  "every taxonomy seed migration is included",
  `${seedFiles().length} files`
)
check(
  aliases.every((a) => (a.isAmbiguous ? !a.canonicalRoleId : !!a.canonicalRoleId)),
  "every alias is either mapped or declared ambiguous, never both or neither"
)
check(
  aliases.every((a) => a.isAmbiguous || (!!a.canonicalRoleSlug && !!a.roleFamily)),
  "every mapped alias resolves to a seeded role with a family"
)

// A broad alias would match dozens of unrelated titles as a whole string. These
// are the ones explicitly ruled out; seeding any of them is a regression.
const BROAD = ["sales", "engineer", "manager", "executive", "director"]
const seededBroad = BROAD.filter((b) => aliases.some((a) => a.alias.toLowerCase() === b))
check(seededBroad.length === 0, "no broad single-word aliases seeded", seededBroad.join(", "))

// ── The classification table ─────────────────────────────────────────────────

type Expected = {
  role: string | null
  family: string | null
  seniority: string | null
  confidence: string | null
}

const CASES: ReadonlyArray<readonly [string, Expected]> = [
  ["Account Executive", { role: "account_executive", family: "sales", seniority: null, confidence: "high" }],
  ["Senior Enterprise Account Executive", { role: "account_executive", family: "sales", seniority: "senior", confidence: "high" }],
  ["Enterprise Account Executive", { role: "account_executive", family: "sales", seniority: null, confidence: "high" }],
  ["Strategic AE", { role: "account_executive", family: "sales", seniority: null, confidence: "high" }],
  ["AE", { role: "account_executive", family: "sales", seniority: null, confidence: "medium" }],
  ["SDR", { role: "sales_development_rep", family: "sales", seniority: null, confidence: "high" }],
  ["VP of Sales", { role: "sales_leadership", family: "sales", seniority: "vp", confidence: "high" }],
  ["Product Manager", { role: "product_manager", family: "product", seniority: null, confidence: "high" }],
  ["Senior Software Engineer", { role: "software_engineer", family: "engineering", seniority: "senior", confidence: "high" }],
  ["PM", { role: null, family: null, seniority: null, confidence: null }],
  ["Sales Engineer", { role: "sales_engineer", family: "sales", seniority: null, confidence: "high" }],
  ["Account Manager", { role: "account_manager", family: "sales", seniority: null, confidence: "high" }],

  // ── Coverage pass 1 (20260913120000) ──────────────────────────────────────
  // Existing roles reached by a new exact alias.
  ["Healthcare Account Executive", { role: "account_executive", family: "sales", seniority: null, confidence: "high" }],
  ["Major Account Executive – Financial Services", { role: "account_executive", family: "sales", seniority: null, confidence: "high" }],
  ["Sr Business Development Representative", { role: "sales_development_rep", family: "sales", seniority: "senior", confidence: "high" }],
  ["BDR", { role: "sales_development_rep", family: "sales", seniority: null, confidence: "medium" }],
  ["Senior Corporate Recruiter", { role: "recruiter", family: "operations", seniority: "senior", confidence: "high" }],
  ["Founding Product Designer", { role: "product_designer", family: "design", seniority: null, confidence: "high" }],
  ["Application Developer – PeopleSoft & Oracle Cloud HCM", { role: "software_engineer", family: "engineering", seniority: null, confidence: "high" }],
  // The two new canonical roles.
  ["Senior Channel Manager – Southeast", { role: "channel_partner_sales", family: "sales", seniority: "senior", confidence: "high" }],
  ["Senior Channel Sales Executive", { role: "channel_partner_sales", family: "sales", seniority: "senior", confidence: "high" }],
  ["Senior Partner Manager", { role: "channel_partner_sales", family: "sales", seniority: "senior", confidence: "high" }],
  ["Lead Recruiting Coordinator", { role: "recruiting_coordinator", family: "operations", seniority: "principal", confidence: "high" }],
  ["Recruitment Coordinator", { role: "recruiting_coordinator", family: "operations", seniority: null, confidence: "high" }],
  // Titles the coverage pass deliberately left alone.
  ["Account Executive/Channel Partnerships Manager", { role: null, family: null, seniority: null, confidence: null }],
  ["Senior Engineer", { role: null, family: null, seniority: null, confidence: null }],
  ["Technical Lead", { role: null, family: null, seniority: null, confidence: null }],
  ["AI/ML Engineer", { role: null, family: null, seniority: null, confidence: null }],
]

section("Classification")
for (const [raw, want] of CASES) {
  const got = classifyTitle(raw, aliases)
  const ok =
    got.canonicalRoleSlug === want.role &&
    got.roleFamily === want.family &&
    got.seniority === want.seniority &&
    got.confidence === want.confidence
  check(
    ok,
    `"${raw}"`,
    ok
      ? `${want.role ?? "unclassified"}${want.seniority ? ` · ${want.seniority}` : ""}`
      : `got role=${got.canonicalRoleSlug} family=${got.roleFamily} seniority=${got.seniority} confidence=${got.confidence}`
  )
}

// ── Whole-string matching, never substring ───────────────────────────────────

section("Whole-string matching only")

const engineer = classifyTitle("Sales Engineer", aliases)
check(
  engineer.canonicalRoleSlug === "sales_engineer",
  "'Sales Engineer' never maps to Sales Leadership",
  `got ${engineer.canonicalRoleSlug}`
)

const am = classifyTitle("Account Manager", aliases)
check(
  am.canonicalRoleSlug === "account_manager",
  "'Account Manager' never maps to Account Executive",
  `got ${am.canonicalRoleSlug}`
)

for (const raw of [
  "Sales",
  "Engineer",
  "Manager",
  "Executive",
  "Director",
  "Account Executive Assistant",
  "Executive Assistant",
  "Sales Operations Analyst",
]) {
  const got = classifyTitle(raw, aliases)
  check(
    got.canonicalRoleSlug === null && got.roleFamily === null,
    `"${raw}" stays unclassified`,
    got.canonicalRoleSlug ?? ""
  )
}

// A declared ambiguity is a *knowing* decline, not an accidental miss.
const pm = classifyTitle("PM", aliases)
check(pm.ambiguous && pm.matchedAlias === "pm", "'PM' declines via its declared-ambiguous rule")
const nothing = classifyTitle("Chief Vibes Officer", aliases)
check(
  !nothing.ambiguous && nothing.canonicalRoleSlug === null,
  "an unknown title declines without claiming ambiguity"
)

// ── Trailing-qualifier separators ────────────────────────────────────────────

section("Qualifier separators")

// Comma, en dash, em dash and pipe introduce a qualifier: the role is on the left.
const SEPARATOR_CASES: ReadonlyArray<readonly [string, string | null, string | null]> = [
  ["Product Manager, Growth", "product_manager", null],
  ["Product Designer | Growth", "product_designer", null],
  ["Major Account Executive – Financial Services", "account_executive", null],
  ["Account Executive — EMEA", "account_executive", null],
  ["Senior Channel Manager – Southeast", "channel_partner_sales", "senior"],
  ["Application Developer – PeopleSoft & Oracle Cloud HCM", "software_engineer", null],
]
for (const [raw, role, seniority] of SEPARATOR_CASES) {
  const got = classifyTitle(raw, aliases)
  const ok = got.canonicalRoleSlug === role && got.seniority === seniority
  check(ok, `"${raw}"`, ok ? "" : `got role=${got.canonicalRoleSlug} seniority=${got.seniority}`)
}

// A slash usually joins two real jobs, so it is NOT a qualifier separator:
// taking the left half would silently pick one of them.
for (const raw of [
  "Account Executive/Channel Partnerships Manager",
  "AI/ML Engineer",
  "Product Manager / Product Owner",
]) {
  const got = classifyTitle(raw, aliases)
  check(
    got.canonicalRoleSlug === null,
    `"${raw}" is not split on the slash`,
    got.canonicalRoleSlug ?? ""
  )
}

// Hyphen-minus is deliberately unsupported as a separator, because it is also
// the word joiner these two titles depend on. Both must keep working.
check(
  classifyTitle("Full-Stack Engineer", aliases).canonicalRoleSlug === "software_engineer",
  "'Full-Stack Engineer' still maps — the hyphen is a word joiner, not a separator"
)
check(
  classifyTitle("Full Stack Engineer", aliases).canonicalRoleSlug === "software_engineer",
  "'Full Stack Engineer' (unhyphenated) still maps"
)
const midMarketAe = classifyTitle("Mid-Market Account Executive", aliases)
check(
  midMarketAe.canonicalRoleSlug === "account_executive" && midMarketAe.seniority === null,
  "'Mid-Market Account Executive' still maps with no seniority",
  `role=${midMarketAe.canonicalRoleSlug} seniority=${midMarketAe.seniority}`
)
// The documented limitation, asserted so it changes deliberately or not at all.
check(
  classifyTitle("Major Account Executive - Financial Services", aliases).canonicalRoleSlug === null,
  "a plain hyphen-minus separator remains unsupported (known limitation)"
)

// A separator with nothing after it is not a qualifier.
check(
  classifyTitle("Product Manager,", aliases).canonicalRoleSlug === "product_manager",
  "a trailing separator with no qualifier after it is ignored"
)
check(
  classifyTitle("Product Manager |", aliases).canonicalRoleSlug === "product_manager",
  "a trailing pipe with no qualifier after it is ignored"
)
// ...and one with nothing before it is not a title.
check(
  classifyTitle(", Growth", aliases).canonicalRoleSlug === null,
  "a leading separator does not produce a match from the qualifier alone"
)

// ── Market qualifiers are never stored ───────────────────────────────────────

section("Market qualifiers are read, never recorded")

for (const raw of [
  "Senior Enterprise Account Executive",
  "Enterprise Account Executive",
  "Strategic Account Executive",
  "Strategic AE",
  "Enterprise Sales Engineer",
  "Mid-Market Account Executive",
]) {
  const got = classifyTitle(raw, aliases)
  const structured = { ...got, normalizedFromTitle: null, matchedAlias: null }
  const leaked = JSON.stringify(structured).toLowerCase()
  check(
    !leaked.includes("enterprise") &&
      !leaked.includes("strategic") &&
      !leaked.includes("mid_market") &&
      !("segment" in got),
    `"${raw}" records no segment/qualifier field`,
    got.canonicalRoleSlug ?? "unclassified"
  )
}

// "mid-market" contains the seniority word "mid"; extracting seniority first
// would make a Mid-Market AE mid-level, which is a different claim about a person.
const midMarket = classifyTitle("Mid-Market Account Executive", aliases)
check(
  midMarket.canonicalRoleSlug === "account_executive" && midMarket.seniority === null,
  "'Mid-Market Account Executive' is an AE with no seniority, not a mid-level one",
  `seniority=${midMarket.seniority}`
)

// ── Seniority extraction ─────────────────────────────────────────────────────

section("Seniority")

const SENIORITY_CASES: ReadonlyArray<readonly [string, string | null, string | null]> = [
  ["Sr. Account Executive", "account_executive", "senior"],
  ["Associate Product Manager", "product_manager", "entry"],
  ["Staff Software Engineer", "software_engineer", "staff"],
  ["Lead Product Designer", "product_designer", "principal"],
  ["Head of Sales", "sales_leadership", "director"],
  ["Chief Revenue Officer", "sales_leadership", "c_level"],
  ["Software Engineer II", "software_engineer", "mid"],
  ["Account Executive", "account_executive", null],
  ["Engineering Manager", "engineering_manager", null],
  ["Customer Success Manager", "customer_success_manager", null],
  ["Senior Account Manager", "account_manager", "senior"],
  ["Product Manager, Growth", "product_manager", null],
  ["Software Engineer (Remote)", "software_engineer", null],
]

for (const [raw, role, seniority] of SENIORITY_CASES) {
  const got = classifyTitle(raw, aliases)
  const ok = got.canonicalRoleSlug === role && got.seniority === seniority
  check(ok, `"${raw}"`, ok ? "" : `got role=${got.canonicalRoleSlug} seniority=${got.seniority}`)
}

// A bare title states no rung. `mid` is a claim the title did not make.
check(
  classifyTitle("Account Executive", aliases).seniority === null,
  "a bare title yields null seniority, never a default"
)

// ── Raw titles are never altered ─────────────────────────────────────────────

section("Raw titles")

for (const raw of [
  "Senior Enterprise Account Executive",
  "Sr. AE",
  "Chief Vibes Officer",
  // The separator path rewrites the *comparison* string heavily; the raw title
  // it reports back must be untouched by every one of those steps.
  "Major Account Executive – Financial Services",
  "Application Developer – PeopleSoft & Oracle Cloud HCM",
  "Product Designer | Growth",
  "Account Executive/Channel Partnerships Manager",
  "Mid-Market Account Executive",
]) {
  check(
    classifyTitle(raw, aliases).normalizedFromTitle === raw,
    `"${raw}" is echoed back byte-for-byte`,
    classifyTitle(raw, aliases).normalizedFromTitle ?? ""
  )
}

check(
  classifyTitle("  Senior   Account Executive  ", aliases).normalizedFromTitle ===
    "Senior   Account Executive",
  "only surrounding whitespace is trimmed — inner text is untouched"
)

const blank = classifyTitle("   ", aliases)
check(
  blank.canonicalRoleSlug === null && blank.source === null && blank.normalizedFromTitle === null,
  "a blank title is unclassified with no source"
)

const unmatched = classifyTitle("Chief Vibes Officer", aliases)
check(
  unmatched.source === null && unmatched.normalizedFromTitle === "Chief Vibes Officer",
  "an unmatched title records what was looked at, with a null source"
)

// ── The re-parse / override policy ───────────────────────────────────────────

section("Re-parse and override policy")

const unchanged = decideNormalization({
  rawTitle: "Account Executive",
  aliases,
  existing: { source: "recruiter", normalizedFromTitle: "Account Executive" },
})
check(
  unchanged.action === "skip",
  "an unchanged raw title preserves an existing recruiter override",
  unchanged.action
)

const unchangedRule = decideNormalization({
  rawTitle: "Account Executive",
  aliases,
  existing: { source: "rule", normalizedFromTitle: "Account Executive" },
})
check(
  unchangedRule.action === "skip",
  "an unchanged raw title does not recompute a rule mapping either",
  unchangedRule.action
)

const changedRecruiter = decideNormalization({
  rawTitle: "VP of Sales",
  aliases,
  existing: { source: "recruiter", normalizedFromTitle: "Account Executive" },
})
check(
  changedRecruiter.action === "preserve" &&
    changedRecruiter.reason === "recruiter_override_stale_title" &&
    changedRecruiter.reviewNeeded === true,
  "a changed raw title preserves a recruiter override and flags review, without recomputing",
  changedRecruiter.action
)

const changedRule = decideNormalization({
  rawTitle: "VP of Sales",
  aliases,
  existing: { source: "rule", normalizedFromTitle: "Account Executive" },
})
check(
  changedRule.action === "write" &&
    changedRule.classification.canonicalRoleSlug === "sales_leadership" &&
    changedRule.classification.seniority === "vp",
  "a changed raw title recomputes a rule-generated mapping",
  changedRule.action
)

const firstEver = decideNormalization({
  rawTitle: "Account Executive",
  aliases,
  existing: { source: null, normalizedFromTitle: null },
})
check(
  firstEver.action === "write" && firstEver.classification.source === "rule",
  "a never-classified candidate is classified"
)

const stillBlank = decideNormalization({
  rawTitle: null,
  aliases,
  existing: { source: null, normalizedFromTitle: null },
})
check(stillBlank.action === "skip", "a candidate with no title at all is left alone")

const titleRemoved = decideNormalization({
  rawTitle: null,
  aliases,
  existing: { source: "rule", normalizedFromTitle: "Account Executive" },
})
check(
  titleRemoved.action === "write" &&
    titleRemoved.classification.canonicalRoleSlug === null &&
    titleRemoved.classification.source === null,
  "a cleared title clears a rule-generated classification"
)

// Nothing in a decision may carry a modified title back to the caller.
check(
  changedRule.action === "write" &&
    changedRule.classification.normalizedFromTitle === "VP of Sales",
  "a write decision carries the raw title unmodified"
)

// ── Result ───────────────────────────────────────────────────────────────────

console.log(
  failures === 0
    ? "\nTitle normalization: all checks passed\n"
    : `\nTitle normalization: ${failures} check(s) failed\n`
)
process.exit(failures === 0 ? 0 : 1)
