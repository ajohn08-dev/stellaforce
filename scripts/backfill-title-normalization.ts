import { createClient } from "@supabase/supabase-js"

import {
  classifyTitle,
  decideNormalization,
  type TitleAliasRule,
} from "../src/lib/title-normalization"
import type { Database } from "../src/lib/supabase/types"

/**
 * Backfill candidate title normalization.
 *
 *   npm run title-backfill              # dry run — reports, writes nothing
 *   npm run title-backfill -- --recheck # re-evaluate already-classified rows too
 *   npm run title-backfill -- --apply   # writes the classification columns
 *
 * `--recheck` exists because of what happens after a taxonomy change. The
 * re-parse policy skips any candidate whose `current_title` still matches
 * `normalized_from_title` — correct for writes (a re-upload of the same résumé
 * must not churn rows), but it means a plain dry run after seeding new aliases
 * reports "28 unchanged" and says nothing about what those new rules would do.
 * `--recheck` ignores the unchanged skip so the run answers "what would the
 * current rule set produce for this bench?".
 *
 * **`--recheck` never touches a recruiter override.** A row whose source is
 * `recruiter` is skipped under every flag combination — that is the one part of
 * the policy no reporting convenience may bend.
 *
 * Runs the *real* `decideNormalization`, so the backfill and every runtime path
 * (creation, ingestion) cannot disagree about what a title means.
 *
 * Writes **only** the seven classification columns. It never touches
 * `current_title`, `current_company`, `headline`, work experience, identity
 * fields, or the embedding vector — a backfill that silently "tidied" a raw
 * title would destroy the provenance this whole feature is built to preserve.
 *
 * Idempotent by construction: `decideNormalization` skips any candidate whose
 * `current_title` still matches `normalized_from_title`, so a second run with
 * unchanged data writes nothing at all. It also honours recruiter overrides —
 * a hand-classified candidate is never recomputed here.
 *
 * ⚠️ **Reports aggregates only.** No name, email, phone, résumé, candidate id or
 * raw title is ever printed: the unmapped-title report is a count, because a
 * list of job titles from a shared terminal is still a list of real people's
 * jobs. Use the app to inspect individuals.
 *
 * Uses the service-role key: this is a backfill with no acting user, the same
 * category as `scripts/seed.ts`.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local."
  )
  process.exit(1)
}

const APPLY = process.argv.includes("--apply")
const RECHECK = process.argv.includes("--recheck")
const BATCH_SIZE = 200

const supabase = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type AliasQueryRow = {
  alias: string
  canonical_role_id: string | null
  implied_seniority: Database["public"]["Enums"]["title_seniority"] | null
  is_ambiguous: boolean
  canonical_role: {
    slug: string
    role_family: Database["public"]["Enums"]["role_family"]
  } | null
}

async function loadAliases(): Promise<TitleAliasRule[]> {
  const { data, error } = await supabase
    .from("title_aliases")
    .select(
      "alias, canonical_role_id, implied_seniority, is_ambiguous, canonical_role:canonical_roles(slug, role_family)"
    )
  if (error) throw new Error(`Failed to load title aliases: ${error.message}`)

  return ((data ?? []) as unknown as AliasQueryRow[]).map((row) => ({
    alias: row.alias,
    canonicalRoleId: row.canonical_role_id,
    canonicalRoleSlug: row.canonical_role?.slug ?? null,
    roleFamily: row.canonical_role?.role_family ?? null,
    impliedSeniority: row.implied_seniority,
    isAmbiguous: row.is_ambiguous,
  }))
}

function tally(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function report(title: string, counts: Map<string, number>) {
  console.log(`\n${title}`)
  if (counts.size === 0) {
    console.log("  (none)")
    return
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const width = Math.max(...rows.map(([k]) => k.length))
  for (const [key, count] of rows) {
    console.log(`  ${key.padEnd(width)}  ${count}`)
  }
}

async function main() {
  const aliases = await loadAliases()
  console.log(
    `\nTitle normalization backfill — ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"}${
      RECHECK ? " · --recheck (already-classified rows re-evaluated)" : ""
    }`
  )
  console.log(`${aliases.length} alias rules loaded\n`)

  const byRole = new Map<string, number>()
  const byFamily = new Map<string, number>()
  const bySeniority = new Map<string, number>()

  let evaluated = 0
  let mapped = 0
  let unclassified = 0
  let ambiguous = 0
  let highConfidence = 0
  let mediumConfidence = 0
  let noTitle = 0
  let rechecked = 0
  let skippedUnchanged = 0
  let skippedRecruiterOverride = 0
  let written = 0
  let writeErrors = 0

  for (let offset = 0; ; offset += BATCH_SIZE) {
    const { data, error } = await supabase
      .from("candidates")
      .select(
        "candidate_id, current_title, title_normalization_source, normalized_from_title"
      )
      // A stable order, so batching cannot skip or repeat a row mid-run.
      .order("candidate_id", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) throw new Error(`Failed to read candidates: ${error.message}`)
    const batch = data ?? []
    if (batch.length === 0) break

    for (const candidate of batch) {
      evaluated++

      let decision = decideNormalization({
        rawTitle: candidate.current_title,
        aliases,
        existing: {
          source: candidate.title_normalization_source,
          normalizedFromTitle: candidate.normalized_from_title,
        },
      })

      // A recruiter's classification is preserved before `--recheck` is even
      // considered, so the flag cannot reach one.
      if (decision.action === "preserve") {
        skippedRecruiterOverride++
        continue
      }

      if (
        RECHECK &&
        decision.action === "skip" &&
        candidate.title_normalization_source !== "recruiter"
      ) {
        rechecked++
        decision = {
          action: "write",
          classification: classifyTitle(candidate.current_title, aliases),
        }
      }

      if (decision.action === "skip") {
        skippedUnchanged++
        continue
      }

      const c = decision.classification

      if (!c.normalizedFromTitle) noTitle++
      else if (c.canonicalRoleSlug) {
        mapped++
        tally(byRole, c.canonicalRoleSlug)
        tally(byFamily, c.roleFamily ?? "—")
        tally(bySeniority, c.seniority ?? "(none stated)")
        if (c.confidence === "medium") mediumConfidence++
        if (c.confidence === "high") highConfidence++
      } else {
        unclassified++
        if (c.ambiguous) ambiguous++
      }

      if (!APPLY) continue

      const { error: writeError } = await supabase
        .from("candidates")
        .update({
          canonical_role_id: c.canonicalRoleId,
          role_family: c.roleFamily,
          seniority: c.seniority,
          title_normalization_source: c.source,
          title_normalization_confidence: c.confidence,
          normalized_from_title: c.normalizedFromTitle,
          title_normalized_at: new Date().toISOString(),
        })
        .eq("candidate_id", candidate.candidate_id)

      if (writeError) {
        // Never print the candidate id alongside a title; a bare id is enough
        // to find the row and carries nothing on its own.
        console.error(`  write failed for ${candidate.candidate_id}: ${writeError.message}`)
        writeErrors++
      } else {
        written++
      }
    }

    if (batch.length < BATCH_SIZE) break
  }

  const pct = (n: number) =>
    evaluated === 0 ? "—" : `${((n / evaluated) * 100).toFixed(1)}%`

  console.log("Summary")
  console.log(`  candidates evaluated          ${evaluated}`)
  console.log(`  mapped to a canonical role    ${mapped}  (${pct(mapped)})`)
  console.log(`    of which high confidence    ${highConfidence}`)
  console.log(`    of which medium confidence  ${mediumConfidence}`)
  console.log(`  unclassified (title present)  ${unclassified}  (${pct(unclassified)})`)
  console.log(`    of which declared ambiguous ${ambiguous}`)
  console.log(`  no current title at all       ${noTitle}`)
  console.log(`  skipped — title unchanged     ${skippedUnchanged}`)
  console.log(`  skipped — recruiter override  ${skippedRecruiterOverride}`)
  if (RECHECK) {
    console.log(`  re-evaluated (--recheck)      ${rechecked}`)
  }

  report("By canonical role", byRole)
  report("By role family", byFamily)
  report("By seniority", bySeniority)

  if (APPLY) {
    console.log(`\nWrote ${written} candidate row(s); ${writeErrors} error(s).`)
  } else {
    console.log(
      "\nDry run — nothing was written. Re-run with `-- --apply` to store these classifications."
    )
  }
  console.log()

  process.exit(writeErrors > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
