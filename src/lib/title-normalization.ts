import type {
  ConfidenceLevel,
  RoleFamily,
  TitleNormalizationSource,
  TitleSeniority,
} from "@/lib/supabase/types"

/**
 * Candidate title normalization — the rules, V1.
 *
 * Deliberately free of `server-only` and of any Supabase import (the type-only
 * import above is erased at build time), for the same reason
 * `src/lib/candidate-search.ts` is: the logic that decides what a title means
 * has to be drivable headless by `npm run title-check`, and a re-implementation
 * inside a test is a test of the wrong thing.
 *
 * ## What this touches
 *
 * It reads a raw title and returns a *classification* to store beside it. It
 * never returns a modified title, and no caller may write one:
 * `candidates.current_title`, `candidates.headline` and
 * `candidate_work_experiences.title` are inputs here and nothing else.
 *
 * ## Three axes, and no fourth
 *
 * Canonical role, role family, seniority. There is no sales segment: for V1,
 * "Enterprise" and "Strategic" stay in the raw title, where the existing
 * free-text "Title contains" filter already finds them. They are stripped here
 * only when that is what it takes to reach a whole-title alias, and the value
 * is then discarded — never stored, never returned.
 *
 * ## Matching is whole-string, never substring
 *
 * Every alias is a complete title. "Sales Engineer" must not match a rule for
 * "sales", and "Account Manager" must not match "Account Executive" — both of
 * which a substring or token-overlap matcher does by default, and both of which
 * put a candidate in a search result they do not belong in. Exact
 * case-insensitive equality is the entire safety property, so the only things
 * this module does before comparing are normalize *formatting* (case, spacing,
 * punctuation) and lift out words that modify a title without changing which
 * role it names.
 */

// ── The shape of a rule ──────────────────────────────────────────────────────

/** One row of `title_aliases`, joined to its canonical role. */
export type TitleAliasRule = {
  /** A whole title, lower-case in the seed. Compared case-insensitively regardless. */
  alias: string
  canonicalRoleId: string | null
  canonicalRoleSlug: string | null
  roleFamily: RoleFamily | null
  /** Used only when the raw title itself carries no seniority word. */
  impliedSeniority: TitleSeniority | null
  /** A declared ambiguity: matches, and deliberately classifies as nothing. */
  isAmbiguous: boolean
}

/** What a classification writes. Every field null = unclassified. */
export type TitleClassification = {
  canonicalRoleId: string | null
  canonicalRoleSlug: string | null
  roleFamily: RoleFamily | null
  seniority: TitleSeniority | null
  /** `rule` when an alias matched; null when nothing did — never a guess. */
  source: TitleNormalizationSource | null
  confidence: ConfidenceLevel | null
  /** The raw title this was computed from, stored so a re-parse can tell it changed. */
  normalizedFromTitle: string | null
  /** Which alias produced the match — for the backfill report and the UI's "why". */
  matchedAlias: string | null
  /** True when a known-ambiguous alias matched: we declined knowingly, not by omission. */
  ambiguous: boolean
}

/** The normalization metadata already on the candidate row. */
export type ExistingNormalization = {
  source: TitleNormalizationSource | null
  normalizedFromTitle: string | null
}

/**
 * What the caller should do. Split from the classification itself because two
 * of the three outcomes write nothing at all, and an "empty update" is how a
 * recruiter's override gets quietly erased by the next résumé upload.
 */
export type NormalizationDecision =
  /** Compute and store. */
  | { action: "write"; classification: TitleClassification }
  /** The title has not changed since it was last classified. */
  | { action: "skip"; reason: "unchanged" }
  /**
   * The title changed, but a human set this classification for the *old* title.
   * Keep their values, change nothing, and surface that it needs another look.
   * A full review queue is out of scope for V1 — this is the signal it will read.
   */
  | { action: "preserve"; reason: "recruiter_override_stale_title"; reviewNeeded: true }

// ── Vocabulary lifted out of the title ───────────────────────────────────────
//
// Phrases, not tokens: "head of" and "vice president" are two words that mean
// one thing, and a token-by-token pass gets both wrong. Ordered longest/most
// specific first, so "vice president" is consumed before "president" would be
// and "mid-level" before "mid".

const SENIORITY_PHRASES: ReadonlyArray<readonly [string, TitleSeniority]> = [
  ["vice president", "vp"],
  ["mid-level", "mid"],
  ["mid level", "mid"],
  ["head of", "director"],
  ["principal", "principal"],
  ["associate", "entry"],
  ["director", "director"],
  ["senior", "senior"],
  ["junior", "entry"],
  ["intern", "intern"],
  ["manager", "manager"],
  ["chief", "c_level"],
  ["staff", "staff"],
  ["lead", "principal"],
  ["svp", "vp"],
  ["cto", "c_level"],
  ["cro", "c_level"],
  ["ceo", "c_level"],
  ["mid", "mid"],
  ["sr", "senior"],
  ["jr", "entry"],
  ["vp", "vp"],
  ["ii", "mid"],
  ["i", "entry"],
]

/**
 * Market qualifiers. **Removed to reach a match, never stored.**
 *
 * "Enterprise Sales Engineer" is a Sales Engineer; the word "Enterprise" says
 * something about the book of business, not about which role this is. V1 makes
 * no structured claim about it — a segment field would have to mean something
 * specific (deal size? account tier? whose definition?) and nothing in the
 * product answers that yet. The word survives untouched in `current_title`,
 * which is what the free-text Title filter searches.
 *
 * Listed before seniority in `classifyTitle` because "mid-market" contains the
 * seniority word "mid": strip seniority first and a Mid-Market AE comes back
 * mid-level, which is a different and wrong claim about a person.
 */
const MARKET_QUALIFIER_PHRASES: readonly string[] = [
  "small business",
  "mid-market",
  "mid market",
  "major accounts",
  "named accounts",
  "enterprise",
  "strategic",
  "smb",
]

/**
 * Aliases that are abbreviations with a real competing expansion outside
 * recruiting — "AE" is also Associate/Application Engineer, "BDR" is read as
 * Business Development *Director* often enough to matter. They still map,
 * because refusing to answer "find me AEs" is the worse failure, but they map at
 * `medium` so a low-confidence sweep can spot-check them. The spelled-out forms
 * ("enterprise ae", "business development representative") are unambiguous in
 * context and stay `high`.
 */
const MEDIUM_CONFIDENCE_ALIASES: ReadonlySet<string> = new Set(["ae", "bdr"])

// ── Formatting normalization (never semantic) ────────────────────────────────

/**
 * Separators that introduce a trailing *qualifier* — a territory, a vertical, a
 * team, a tech stack — rather than part of the role's name. Everything after
 * the first one is dropped for comparison purposes.
 *
 *  - `,` and `|` cut unconditionally: neither ever appears inside a job-title
 *    word, so there is nothing to misread.
 *  - `–` and `—` cut **only with whitespace on at least one side**. An en dash
 *    used as a word joiner ("Full–Stack") is rare but real, and cutting there
 *    would turn a Full-Stack Engineer into "full". Requiring the space is the
 *    same distinction the hyphen case fails to offer (see below).
 *
 * **`/` is deliberately absent.** A slash usually joins two real titles —
 * "Account Executive/Channel Partnerships Manager" is a person doing both jobs,
 * not an AE with a qualifier — and picking the left half would silently choose
 * one of them. Those stay unclassified, which is the honest answer.
 *
 * **Plain hyphen-minus `-` is also absent, and this is a known limitation.**
 * It is the separator in "Major Account Executive - Financial Services" *and*
 * the joiner in "Full-Stack Engineer" and "Mid-Market Account Executive". A
 * whitespace rule would separate those two uses, but the hyphen is the one
 * character whose word-joining use this module already depends on (the
 * `(?<![\w-])` boundaries below exist precisely for it), so it stays
 * unsupported in this pass rather than being half-handled.
 */
const QUALIFIER_SEPARATOR = /[,|]|(?<=\s)[–—]|[–—](?=\s)/

/**
 * Lower-case, de-punctuate, and drop trailing qualifiers — the formatting
 * differences between "Sr. Account Executive (Remote)" and "senior account
 * executive" that should not decide whether a rule matches.
 *
 * A cut is only applied when there is a real title on the left *and* a real
 * qualifier on the right: "Product Manager, Growth" is a Product Manager, while
 * ", Growth" is not a title and "Product Manager," is not a qualified one.
 */
export function normalizeForComparison(rawTitle: string): string {
  let text = rawTitle.toLowerCase()

  // Parenthetical asides anywhere: "(Remote)", "(Contract)", "(EMEA)".
  text = text.replace(/\([^)]*\)/g, " ")

  const separator = QUALIFIER_SEPARATOR.exec(text)
  if (separator) {
    const left = text.slice(0, separator.index).trim()
    const right = text.slice(separator.index + separator[0].length).trim()
    if (left && right) text = left
  }

  // `sr.` → `sr`, `v.p.` → `vp`, and any separator left over because nothing
  // followed it. Hyphens survive: "mid-market" and "full-stack" are matched
  // with and without them below.
  text = text.replace(/[.,;:"'`–—|]/g, "")

  return text.replace(/\s+/g, " ").trim()
}

function wordBoundaryRegex(phrase: string): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  // (?<![\w-]) / (?![\w-]) rather than \b: \b treats a hyphen as a boundary,
  // which would let "mid" match inside "mid-market".
  return new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`)
}

function containsPhrase(text: string, phrase: string): boolean {
  return wordBoundaryRegex(phrase).test(text)
}

function removePhrase(text: string, phrase: string): string {
  return text.replace(wordBoundaryRegex(phrase), " ").replace(/\s+/g, " ").trim()
}

/**
 * Lift the first matching phrase out of the title, returning the value and the
 * title without it. Only the first match: "Senior Senior Engineer" is not a
 * thing, and looping here would strip words out of a role name.
 */
function extractSeniority(text: string): {
  value: TitleSeniority | null
  rest: string
} {
  for (const [phrase, value] of SENIORITY_PHRASES) {
    if (containsPhrase(text, phrase)) {
      return { value, rest: removePhrase(text, phrase) }
    }
  }
  return { value: null, rest: text }
}

/** Strip market qualifiers. The words are discarded — nothing records them. */
function stripMarketQualifiers(text: string): string {
  for (const phrase of MARKET_QUALIFIER_PHRASES) {
    if (containsPhrase(text, phrase)) return removePhrase(text, phrase)
  }
  return text
}

// ── Matching ─────────────────────────────────────────────────────────────────

function buildIndex(aliases: readonly TitleAliasRule[]): Map<string, TitleAliasRule> {
  const index = new Map<string, TitleAliasRule>()
  for (const rule of aliases) index.set(normalizeForComparison(rule.alias), rule)
  return index
}

function lookup(
  aliasIndex: Map<string, TitleAliasRule>,
  comparison: string
): TitleAliasRule | null {
  if (!comparison) return null
  return (
    aliasIndex.get(comparison) ??
    // "full-stack engineer" and "full stack engineer" are the same title; both
    // are seeded, but a de-hyphenated retry means a new alias only has to be
    // added once.
    aliasIndex.get(comparison.replace(/-/g, " ")) ??
    null
  )
}

const UNCLASSIFIED: Omit<TitleClassification, "normalizedFromTitle"> = {
  canonicalRoleId: null,
  canonicalRoleSlug: null,
  roleFamily: null,
  seniority: null,
  source: null,
  confidence: null,
  matchedAlias: null,
  ambiguous: false,
}

/**
 * Classify one raw title.
 *
 * Three passes, and the order is load-bearing:
 *
 *  1. **The whole title, exactly as written.** "Product Manager" and "Account
 *     Manager" are roles whose own names end in a seniority word, and "VP of
 *     Sales" is a role whose name contains one. Extracting first would reduce
 *     them to "product", "account" and "of sales" and classify none of them.
 *  2. **Seniority lifted out**, then matched again — which is what handles
 *     "Senior Account Executive" without seeding a row per combination.
 *  3. **Market qualifiers lifted out too**, for titles like "Enterprise Sales
 *     Engineer" that no alias covers. The qualifier is dropped on the floor.
 *
 * Within passes 2 and 3, qualifiers come out before seniority, because
 * "mid-market" contains "mid".
 */
export function classifyTitle(
  rawTitle: string | null | undefined,
  aliases: readonly TitleAliasRule[]
): TitleClassification {
  const raw = (rawTitle ?? "").trim()
  if (!raw) return { ...UNCLASSIFIED, normalizedFromTitle: null }

  const index = buildIndex(aliases)
  const comparison = normalizeForComparison(raw)

  // Pass 1 — the title as written.
  const direct = lookup(index, comparison)
  if (direct) return fromRule(direct, raw, null)

  // Pass 2 — lift out the seniority word.
  const seniorityOnly = extractSeniority(comparison)
  const afterSeniority = lookup(index, seniorityOnly.rest)
  if (afterSeniority) return fromRule(afterSeniority, raw, seniorityOnly.value)

  // Pass 3 — lift out a market qualifier as well, and re-extract seniority from
  // what is left (the qualifier may have sat between the two).
  const stripped = stripMarketQualifiers(comparison)
  if (stripped !== comparison) {
    const both = extractSeniority(stripped)
    const afterBoth = lookup(index, both.rest)
    if (afterBoth) return fromRule(afterBoth, raw, both.value)
  }

  // Nothing matched. Record what we looked at and classify nothing — no
  // family-only guess from a leftover keyword, which is how "Sales Operations
  // Analyst" would become a salesperson.
  return { ...UNCLASSIFIED, normalizedFromTitle: raw }
}

function fromRule(
  rule: TitleAliasRule,
  raw: string,
  extractedSeniority: TitleSeniority | null
): TitleClassification {
  // A declared ambiguity resolves to nothing — but knowingly, which is why it
  // is a matched rule rather than a miss.
  if (rule.isAmbiguous || !rule.canonicalRoleId) {
    return {
      ...UNCLASSIFIED,
      normalizedFromTitle: raw,
      matchedAlias: rule.alias,
      ambiguous: true,
    }
  }

  return {
    canonicalRoleId: rule.canonicalRoleId,
    canonicalRoleSlug: rule.canonicalRoleSlug,
    roleFamily: rule.roleFamily,
    // What the recruiter actually wrote beats what the alias implies: "Senior
    // VP of Sales" should not come back as plain `vp` because the alias said so.
    seniority: extractedSeniority ?? rule.impliedSeniority ?? null,
    source: "rule",
    confidence: MEDIUM_CONFIDENCE_ALIASES.has(normalizeForComparison(rule.alias))
      ? "medium"
      : "high",
    normalizedFromTitle: raw,
    matchedAlias: rule.alias,
    ambiguous: false,
  }
}

// ── The re-parse / override policy ───────────────────────────────────────────

/**
 * Decide what to do with a candidate whose current title may have moved.
 *
 * The policy in three lines:
 *
 *  - unchanged title → touch nothing (a re-upload of the same résumé must be a
 *    no-op, or every ingestion rewrites rows and bumps timestamps for nothing);
 *  - changed title + a recruiter's classification → keep theirs, flag for
 *    review, and **do not recompute** (their decision was about a title the
 *    candidate no longer holds; that needs a human, not an overwrite);
 *  - anything else → recompute deterministically.
 *
 * Note there is no "recompute and compare" branch. Recomputing a recruiter's
 * row to see whether the rules now agree is how an override gets lost to a
 * refactor six months later.
 */
export function decideNormalization(input: {
  rawTitle: string | null | undefined
  aliases: readonly TitleAliasRule[]
  existing: ExistingNormalization
}): NormalizationDecision {
  const raw = (input.rawTitle ?? "").trim() || null
  const previous = input.existing.normalizedFromTitle?.trim() || null

  if (raw === previous) return { action: "skip", reason: "unchanged" }

  if (input.existing.source === "recruiter") {
    return {
      action: "preserve",
      reason: "recruiter_override_stale_title",
      reviewNeeded: true,
    }
  }

  return { action: "write", classification: classifyTitle(raw, input.aliases) }
}
