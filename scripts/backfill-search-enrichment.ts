import { createClient } from "@supabase/supabase-js"

import {
  ENRICHMENT_VERSION,
  readinessFor,
  reviewReasonsFor,
  REVIEW_REASON_LABELS,
  type ReviewReason,
} from "../src/lib/candidate-readiness"
import {
  decideNormalization,
  type TitleAliasRule,
} from "../src/lib/title-normalization"
import { toCountryCode } from "../src/lib/country-normalization"
import type { Database } from "../src/lib/supabase/types"

/**
 * Backfill candidate search-enrichment state.
 *
 *   npm run enrichment-backfill            # dry run — reports, writes nothing
 *   npm run enrichment-backfill -- --apply # writes state + classification
 *
 * Runs the *real* rules — `decideNormalization` for the title and
 * `reviewReasonsFor` for readiness — so the backfill and every runtime path
 * cannot disagree about what "properly searchable" means.
 *
 * Writes only `candidate_search_state` and, where the title rules produce one,
 * the candidate's seven classification columns. It never touches a raw field:
 * `current_title`, `current_company`, `headline`, work experience, skills and
 * identity are inputs here and nothing else.
 *
 * ⚠️ **Aggregates only.** No name, email, phone, résumé or raw title is ever
 * printed — a list of job titles from a shared terminal is still a list of real
 * people's jobs. Use the app to inspect an individual.
 *
 * Service-role key: a backfill has no acting user, the same category as
 * `scripts/seed.ts`.
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

function report(title: string, counts: Map<string, number>, label?: (k: string) => string) {
  console.log(`\n${title}`)
  if (counts.size === 0) {
    console.log("  (none)")
    return
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const width = Math.max(...rows.map(([k]) => (label ? label(k) : k).length))
  for (const [key, count] of rows) {
    console.log(`  ${(label ? label(key) : key).padEnd(width)}  ${count}`)
  }
}

async function main() {
  const aliases = await loadAliases()
  console.log(
    `\nSearch enrichment backfill — ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"}`
  )
  console.log(`${aliases.length} alias rules loaded · rules v${ENRICHMENT_VERSION}\n`)

  const byReadiness = new Map<string, number>()
  const byReason = new Map<string, number>()

  let evaluated = 0
  let classified = 0
  let classificationWrites = 0
  let overridesPreserved = 0
  let countryResolved = 0
  let stateWrites = 0
  let errors = 0

  for (let offset = 0; ; offset += BATCH_SIZE) {
    const { data, error } = await supabase
      .from("candidates")
      .select(
        "candidate_id, current_title, canonical_role_id, role_family, seniority, location_city, location_country, country_code, years_experience, title_normalization_source, normalized_from_title"
      )
      .order("candidate_id", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) throw new Error(`Failed to read candidates: ${error.message}`)
    const batch = data ?? []
    if (batch.length === 0) break

    for (const candidate of batch) {
      evaluated++

      // ── Title, through the real policy ───────────────────────────────────
      const decision = decideNormalization({
        rawTitle: candidate.current_title,
        aliases,
        existing: {
          source: candidate.title_normalization_source,
          normalizedFromTitle: candidate.normalized_from_title,
        },
      })

      // What the candidate's classification will be *after* this run.
      let canonicalRoleId = candidate.canonical_role_id
      let overrideTitleChanged = false

      if (decision.action === "preserve") {
        overrideTitleChanged = true
        overridesPreserved++
      } else if (decision.action === "write") {
        canonicalRoleId = decision.classification.canonicalRoleId
        classificationWrites++
      }

      if (canonicalRoleId) classified++

      // ── Everything else the rules need ───────────────────────────────────
      //
      // `search_dirty_at` is read here so the clear below can be conditional on
      // it — same discipline as the reconciler, so a write landing mid-backfill
      // is not silently marked clean.
      const [{ data: experiences }, skills, { data: resume }, { data: priorState }] =
        await Promise.all([
        supabase
          .from("candidate_work_experiences")
          .select("title, is_current, display_order, start_date")
          .eq("candidate_id", candidate.candidate_id),
        supabase
          .from("candidate_skills")
          .select("id", { count: "exact", head: true })
          .eq("candidate_id", candidate.candidate_id),
        supabase
          .from("resumes")
          .select("parse_status")
          .eq("candidate_id", candidate.candidate_id)
          .eq("is_current", true)
          .maybeSingle(),
        supabase
          .from("candidate_search_state")
          .select("search_dirty_at")
          .eq("candidate_id", candidate.candidate_id)
          .maybeSingle(),
      ])

      const countryCode = toCountryCode(candidate.location_country)

      const reasons = reviewReasonsFor({
        currentTitle: candidate.current_title,
        canonicalRoleId,
        locationCity: candidate.location_city,
        locationCountry: candidate.location_country,
        countryCode,
        yearsExperience: candidate.years_experience,
        skillCount: skills.count ?? 0,
        workExperiences: (experiences ?? []).map((e) => ({
          title: e.title,
          isCurrent: e.is_current ?? false,
          displayOrder: e.display_order,
          startDate: e.start_date,
        })),
        currentResumeParseStatus: resume?.parse_status ?? null,
        overrideTitleChanged,
      })
      const readiness = readinessFor(reasons)

      if (countryCode) countryResolved++
      tally(byReadiness, readiness)
      for (const reason of reasons) tally(byReason, reason)

      if (!APPLY) continue

      // ── Write: classification first, then state ──────────────────────────
      if (decision.action === "write") {
        const c = decision.classification
        const { error: titleError } = await supabase
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
        if (titleError) {
          console.error(`  classification write failed for ${candidate.candidate_id}`)
          errors++
        }
      }

      if (countryCode !== candidate.country_code) {
        const { error: countryError } = await supabase
          .from("candidates")
          .update({ country_code: countryCode })
          .eq("candidate_id", candidate.candidate_id)
        if (countryError) {
          console.error(`  country write failed for ${candidate.candidate_id}`)
          errors++
        }
      }

      const { error: stateError } = await supabase.from("candidate_search_state").upsert(
        {
          candidate_id: candidate.candidate_id,
          readiness,
          review_reasons: reasons,
          reconciled_at: new Date().toISOString(),
          reconciled_watermark: priorState?.search_dirty_at ?? new Date().toISOString(),
          attempt_count: 0,
          last_error: null,
          enrichment_version: ENRICHMENT_VERSION,
        },
        { onConflict: "candidate_id" }
      )
      if (stateError) {
        console.error(`  state write failed for ${candidate.candidate_id}`)
        errors++
      } else {
        stateWrites++
        // Conditional: only the flag this pass actually serviced.
        if (priorState?.search_dirty_at) {
          await supabase
            .from("candidate_search_state")
            .update({ search_dirty_at: null })
            .eq("candidate_id", candidate.candidate_id)
            .eq("search_dirty_at", priorState.search_dirty_at)
        }
      }
    }

    if (batch.length < BATCH_SIZE) break
  }

  const pct = (n: number) =>
    evaluated === 0 ? "—" : `${((n / evaluated) * 100).toFixed(1)}%`

  console.log("Summary")
  console.log(`  candidates evaluated            ${evaluated}`)
  console.log(`  classified (role assigned)      ${classified}  (${pct(classified)})`)
  console.log(`  classification writes           ${classificationWrites}`)
  console.log(`  recruiter overrides preserved   ${overridesPreserved}`)
  console.log(`  country resolved to ISO-2       ${countryResolved}  (${pct(countryResolved)})`)

  report("By readiness", byReadiness)
  report("By review reason", byReason, (k) => REVIEW_REASON_LABELS[k as ReviewReason] ?? k)

  if (APPLY) {
    console.log(`\nWrote ${stateWrites} state row(s); ${errors} error(s).`)
  } else {
    console.log(
      "\nDry run — nothing was written. Re-run with `-- --apply` to store this state."
    )
  }
  console.log()
  process.exit(errors > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
