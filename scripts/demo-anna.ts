import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/types"

/**
 * Demo controls for one candidate on one job. Advance her, reset her, or ask
 * where she is.
 *
 *     npx tsx --conditions=react-server --env-file=.env.local scripts/demo-anna.ts status
 *     npx tsx --conditions=react-server --env-file=.env.local scripts/demo-anna.ts advance
 *     npx tsx --conditions=react-server --env-file=.env.local scripts/demo-anna.ts reset
 *
 * ⚠️ **Every delete here is scoped to this one application.** That is not a
 * stylistic preference. `scripts/scheduling-e2e.ts` clears the scheduling tables
 * with `.not("id","is",null)` — every row, whoever made it — and running it
 * destroyed a real booking made from a real link. Nothing in this file may ever
 * be written that way.
 *
 * `advance` moves exactly one step, in pipeline order: sort by the Tier-1
 * stage's `display_order`, then the sub-stage's. A flat list sorted by
 * `display_order` alone is wrong here — five sub-stages on this job share
 * `display_order = 0` because that column orders *within* a Tier-1 stage.
 */

const CANDIDATE_EMAIL = "ajohndesign08@gmail.com"

const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function line(label: string, value: unknown) {
  console.log(`  ${label.padEnd(24)} ${value}`)
}

async function context() {
  const { data: candidate } = await db
    .from("candidates")
    .select("candidate_id, first_name, last_name, email")
    .eq("email", CANDIDATE_EMAIL)
    .single()
  const { data: app } = await db
    .from("applications")
    .select("application_id, candidate_id, job_id, client_id, current_stage_id, status")
    .eq("candidate_id", candidate!.candidate_id)
    .eq("status", "active")
    .single()

  // Pipeline order: Tier-1 first, then position within it.
  const { data: stages } = await db
    .from("job_workflow_sub_stages")
    .select("id, name, display_order, agent_id, pipeline_stage:pipeline_stages(name, display_order)")
    .eq("job_id", app!.job_id)

  const ordered = (stages ?? [])
    .map((s) => ({
      id: s.id,
      name: s.name,
      tier1: (s.pipeline_stage as { name: string; display_order: number } | null)?.name ?? "",
      tier1Order:
        (s.pipeline_stage as { name: string; display_order: number } | null)?.display_order ?? 0,
      subOrder: s.display_order ?? 0,
      agentId: s.agent_id,
    }))
    .sort((a, b) => a.tier1Order - b.tier1Order || a.subOrder - b.subOrder)

  return { candidate: candidate!, app: app!, ordered }
}

async function status() {
  const { candidate, app, ordered } = await context()
  const current = ordered.find((s) => s.id === app.current_stage_id)
  const index = ordered.findIndex((s) => s.id === app.current_stage_id)

  console.log(`\n${candidate.first_name} ${candidate.last_name} <${candidate.email}>`)
  line("application", app.application_id)
  line("stage", current ? `${current.tier1} › ${current.name}` : "unknown")
  line("next", index >= 0 && ordered[index + 1] ? ordered[index + 1].name : "— end of pipeline")

  const [{ data: requests }, { data: interviews }, { data: calls }, { data: recordings }] =
    await Promise.all([
      db
        .from("interview_scheduling_requests")
        .select("id, status, token_expires_at")
        .eq("application_id", app.application_id),
      db
        .from("interviews")
        .select("id, status, scheduled_at")
        .eq("application_id", app.application_id),
      db
        .from("scheduled_agent_calls")
        .select("id, status, suppressed_reason")
        .eq("application_id", app.application_id),
      db
        .from("call_recordings")
        .select("id, call_status, evaluation_id, transcript_status")
        .eq("application_id", app.application_id),
    ])

  console.log("\nScheduling")
  line("requests", (requests ?? []).map((r) => r.status).join(", ") || "none")
  line("interviews", (interviews ?? []).map((i) => i.status).join(", ") || "none")
  line(
    "queued calls",
    (calls ?? []).map((c) => `${c.status}${c.suppressed_reason ? `(${c.suppressed_reason})` : ""}`).join(", ") ||
      "none"
  )
  line(
    "recordings",
    (recordings ?? [])
      .map((r) => `${r.call_status ?? "?"} eval=${r.evaluation_id ? "linked" : "UNLINKED"}`)
      .join(", ") || "none"
  )
  console.log("")
}

async function advance() {
  const { app, ordered } = await context()
  const index = ordered.findIndex((s) => s.id === app.current_stage_id)
  const next = index >= 0 ? ordered[index + 1] : undefined
  if (!next) {
    console.log("\nNothing to advance to — she is at the end of the pipeline.\n")
    return
  }

  console.log(`\nAdvancing to ${next.name}`)
  const { moveApplicationToStage } = await import("@/lib/server/pipeline-commands")
  const moved = await moveApplicationToStage(db, {
    applicationId: app.application_id,
    targetSubStageId: next.id,
    actor: { profileId: null, systemSource: "demo:anna" },
  })
  if (!moved.ok) {
    console.log(`  failed — ${moved.error}\n`)
    return
  }
  line("moved", "ok")

  // The booking request is a consequence of the move, not a second action —
  // report whatever the real path produced rather than asserting it.
  const { data: request } = await db
    .from("interview_scheduling_requests")
    .select("id, status, dispatched_to_n8n_at, token_expires_at, failure_reason_code")
    .eq("application_id", app.application_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!request) {
    line("booking link", "none — this stage does not self-schedule")
  } else {
    line("request", request.id)
    line("status", request.status)
    line("posted to n8n", request.dispatched_to_n8n_at ?? "never")
    line("token expires", request.token_expires_at)
    if (request.failure_reason_code) line("failure", request.failure_reason_code)
  }
  console.log("")
}

async function reset() {
  const { app, ordered } = await context()
  const first = ordered[0]

  console.log(`\nResetting to ${first.name}`)

  // Scoped to this application, every one of them. Order matters: calls and
  // recordings reference interviews, interviews reference requests.
  const { data: interviews } = await db
    .from("interviews")
    .select("id")
    .eq("application_id", app.application_id)
  const interviewIds = (interviews ?? []).map((i) => i.id)

  await db.from("scheduled_agent_calls").delete().eq("application_id", app.application_id)
  if (interviewIds.length > 0) {
    await db.from("call_recordings").delete().in("interview_id", interviewIds)
    await db
      .from("interview_scheduling_requests")
      .update({ interview_id: null })
      .in("interview_id", interviewIds)
  }
  // Holds hang off the request, not the application — there is no
  // `application_id` on that table.
  const { data: requestRows } = await db
    .from("interview_scheduling_requests")
    .select("id")
    .eq("application_id", app.application_id)
  const requestIds = (requestRows ?? []).map((r) => r.id)
  if (requestIds.length > 0) {
    await db.from("interview_slot_holds").delete().in("request_id", requestIds)
  }
  await db.from("interviews").delete().eq("application_id", app.application_id)
  await db
    .from("interview_scheduling_requests")
    .delete()
    .eq("application_id", app.application_id)
  line("scheduling rows", "cleared for this application")

  // Her position, and a history that matches it.
  await db
    .from("applications")
    .update({ current_stage_id: first.id })
    .eq("application_id", app.application_id)
  await db
    .from("application_stage_history")
    .delete()
    .eq("application_id", app.application_id)
    .neq("sub_stage_id", first.id)
  await db
    .from("application_stage_history")
    .update({ exited_at: null, outcome: null, decided_by: null })
    .eq("application_id", app.application_id)
    .eq("sub_stage_id", first.id)
  line("pipeline position", first.name)

  // Only the events this demo's own moves wrote. Keyed per (application, stage),
  // so nothing another actor logged is touched.
  const keys = ordered.flatMap((s) => [
    `candidate_leaves_stage:${app.application_id}:${s.id}`,
    `candidate_advanced:${app.application_id}:${s.id}`,
    `candidate_added_to_stage:${app.application_id}:${s.id}`,
  ])
  const { data: removed, error } = await db
    .from("activity_events")
    .delete()
    .eq("application_id", app.application_id)
    .in("idempotency_key", keys)
    .select("id")
  line("move events removed", error ? `FAILED — ${error.message}` : (removed?.length ?? 0))

  // Booking/scheduling events have no meaning once their rows are gone.
  const { data: alsoRemoved } = await db
    .from("activity_events")
    .delete()
    .eq("application_id", app.application_id)
    .in("event_type", [
      "booking_link_sent",
      "booking_link_opened",
      "interview_scheduled",
      "agent_call_dispatched",
      "automation_skipped_by_policy",
      "scheduling_failed",
    ])
    .select("id")
  line("scheduling events removed", alsoRemoved?.length ?? 0)
  console.log("")
}

const command = process.argv[2] ?? "status"
const run = command === "advance" ? advance : command === "reset" ? reset : status
run().catch((err) => {
  console.error(err)
  process.exit(1)
})
