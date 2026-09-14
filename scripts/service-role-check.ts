import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

/**
 * The service-role key bypasses RLS entirely, so the candidate-visibility rule
 * (CLAUDE.md → Candidate visibility) is only as good as the list of places that
 * opt out of it. RLS cannot catch this: a Server Action that reaches for
 * `admin.ts` instead of the request-scoped client is indistinguishable, to
 * Postgres, from n8n.
 *
 * So the list is written down. Every file that imports `createAdminClient` must
 * appear below with a reason, and the reason must be one of two things:
 *
 *   - there is no acting user (a cron tick, a webhook, a bearer-authed n8n call,
 *     a candidate on a public booking page who has no login), or
 *   - there is an acting user and they were authorized in code first, which the
 *     reason has to say explicitly.
 *
 * A new entry is not a failure. Adding one deliberately, with a sentence saying
 * why, is the entire point — what this catches is the one added by accident.
 */

let failures = 0
function check(ok: boolean, label: string, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

// ── The allowlist ────────────────────────────────────────────────────────────

const ALLOWED: Record<string, string> = {
  "src/lib/supabase/admin.ts": "the factory itself",

  // No acting user — system, webhook, cron, or bearer-authed n8n.
  "src/app/api/calls/postcall/route.ts": "ElevenLabs post-call webhook, HMAC-verified",
  "src/app/api/cron/agent-call-dispatch/route.ts": "cron tick, no session",
  "src/app/api/cron/scheduling-sweep/route.ts": "cron tick, no session",
  "src/app/api/cron/search-enrichment-sweep/route.ts":
    "cron tick, no session; reconciles derived search data for candidates whose " +
    "in-process reconciliation was missed or failed. Reads the candidate domain " +
    "and writes only classification + candidate_search_state — never a raw field",
  "src/app/api/cron/sla-check/route.ts": "cron tick, no session",
  "src/app/api/applications/[applicationId]/move-stage/route.ts": "bearer-authed n8n, no session",
  "src/app/api/interviews/[interviewId]/complete/route.ts": "system callback, no session",
  "src/app/api/scheduling/booking-link/route.ts": "system-issued booking link, no session",
  "src/app/api/calendar/oauth/callback/route.ts": "OAuth redirect, arrives without a session",
  "src/app/api/calendar/token/route.ts": "token refresh, no acting user",
  "src/app/api/jobs/ai/role/route.ts": "job-AI authoring hop, output lands in the caller's own draft",
  // (src/lib/server/activity.ts deliberately absent: it takes whichever client
  // its caller holds rather than creating one, so it inherits the caller's
  // scoping instead of escalating past it. That is the pattern to copy.)
  "src/lib/server/automation-scope-state.ts": "resolves the account switch, called from system paths",
  "src/lib/server/booking-request.ts": "mints scheduling requests, no acting user",
  "src/lib/server/calendar-events.ts": "Google calendar side-effects, no acting user",
  "src/lib/server/calendar-invite.ts": "Google calendar side-effects, no acting user",
  "src/lib/server/candidate-ingest.ts": "n8n resume ingestion, privileged write with no recruiter session",
  "src/lib/server/elevenlabs-postcall.ts": "post-call webhook persistence, no session",
  "src/lib/server/booking-core.ts":
    "public booking endpoints — candidates have no login, so RLS is not the guard here; " +
    "the three rules at the top of src/app/book/ are (never select *, never trust a client " +
    "identifier, never read another candidate's row)",

  // There IS an acting user. Each of these must authorize before it escalates.
  "src/app/(app)/switch-user-actions.ts":
    "auth.admin.generateLink; gated on profiles.side='stellaforce' AND role='admin' first",
  "src/app/(app)/agents/actions.ts":
    "deletes call_recordings rows and their Storage objects; Storage removal needs service role",
  "src/app/interview-room/actions.ts":
    "uploads room recordings to Storage and links them onto call_recordings",
  "src/lib/data.ts":
    "exactly one call, for google_calendar_connections, returning only a derived boolean — " +
    "asserted below, because this is the read layer and every candidate read must stay scoped",
}

// ── Scan ─────────────────────────────────────────────────────────────────────

const ROOT = process.cwd()
const SRC = join(ROOT, "src")

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.(ts|tsx)$/.test(entry) ? [full] : []
  })
}

const found = walk(SRC)
  .filter((file) => readFileSync(file, "utf8").includes("createAdminClient"))
  .map((file) => relative(ROOT, file).split("\\").join("/"))
  .sort()

console.log("\nService-role usage\n")

// 1. Nothing new may appear without a stated reason.
const unlisted = found.filter((file) => !(file in ALLOWED))
check(
  unlisted.length === 0,
  "every service-role call site is allowlisted with a reason",
  unlisted.length
    ? `unlisted: ${unlisted.join(", ")} — add it to ALLOWED in this script with a sentence saying why RLS is not the guard there`
    : `${found.length} call sites`
)

// 2. A stale entry is a rotted reason; it also hides a re-add.
const stale = Object.keys(ALLOWED).filter((file) => !found.includes(file))
check(
  stale.length === 0,
  "no stale allowlist entries",
  stale.length ? `no longer use the admin client: ${stale.join(", ")}` : ""
)

// 3. The read layer stays clean. `src/lib/data.ts` is where every candidate read
//    lives; one admin call there is documented and narrow, two is a regression
//    nobody would notice in review.
const dataTs = readFileSync(join(SRC, "lib", "data.ts"), "utf8")
const adminCalls = dataTs.match(/createAdminClient\(\)/g)?.length ?? 0
check(
  adminCalls === 1,
  "src/lib/data.ts instantiates the admin client exactly once",
  `found ${adminCalls}`
)

// 4. …and that one call must not touch the candidate domain. Read from the call
//    to the end of its statement rather than the whole file, which is full of
//    legitimate scoped candidate queries.
const CANDIDATE_TABLES = [
  "candidates",
  "candidate_work_experiences",
  "candidate_skills",
  "candidate_tools",
  "candidate_education",
  "candidate_certifications",
  "candidate_links",
  "resumes",
  "applications",
  "candidate_client_fit",
  "placements",
  "interactions",
]
const adminIndex = dataTs.indexOf("createAdminClient()")
const adminWindow = adminIndex === -1 ? "" : dataTs.slice(adminIndex, adminIndex + 600)
const leaked = CANDIDATE_TABLES.filter((t) => adminWindow.includes(`.from("${t}")`))
check(
  leaked.length === 0,
  "the admin client in data.ts does not read the candidate domain",
  leaked.length ? `reads ${leaked.join(", ")} with RLS bypassed` : ""
)

// 5. The factory must stay server-only, or the service-role key can be bundled.
check(
  readFileSync(join(SRC, "lib", "supabase", "admin.ts"), "utf8").includes('import "server-only"'),
  "admin.ts is guarded by import \"server-only\""
)

console.log(
  failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`
)
if (failures) process.exit(1)
