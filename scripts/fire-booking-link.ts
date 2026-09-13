import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/types"

/**
 * Fire one **real** booking-link dispatch at n8n, for one named candidate.
 *
 * Unlike `scheduling-e2e`, nothing here is a fixture: a real application moves
 * onto a real stage, a real `interview_scheduling_requests` row is created with
 * a real single-use token, and the real payload is POSTed to whatever
 * `N8N_BOOKING_LINK_WEBHOOK_URL` points at.
 *
 * It reverts the stage config and the stage move on the way out, because
 * leaving a real pipeline stage self-scheduling is exactly the bug commit
 * 396d59f fixed. The scheduling request is deliberately **left in place** so the
 * ids n8n received still resolve if you want to hand-run the gate against them.
 *
 *     npx tsx --conditions=react-server --env-file=.env.local scripts/fire-booking-link.ts
 */

const CANDIDATE_EMAIL = "ajohndesign08@gmail.com"
const STAGE_NAME = "Pre-Screening"

const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function line(label: string, value: unknown) {
  console.log(`  ${label.padEnd(26)} ${value}`)
}

async function main() {
  console.log(`\nWebhook target: ${process.env.N8N_BOOKING_LINK_WEBHOOK_URL ?? "(default)"}`)

  const { data: candidate } = await db
    .from("candidates")
    .select("candidate_id, first_name, last_name, email, source")
    .eq("email", CANDIDATE_EMAIL)
    .single()
  const { data: app } = await db
    .from("applications")
    .select("application_id, candidate_id, job_id, client_id, current_stage_id, status")
    .eq("candidate_id", candidate!.candidate_id)
    .eq("status", "active")
    .single()
  const { data: stage } = await db
    .from("job_workflow_sub_stages")
    .select("id, name, interviewer_type, agent_id, entry_conditions, scheduling_mode, duration_minutes, config")
    .eq("job_id", app!.job_id)
    .eq("name", STAGE_NAME)
    .single()

  console.log("\nTarget")
  line("candidate", `${candidate!.first_name} ${candidate!.last_name} <${candidate!.email}>`)
  line("source", candidate!.source)
  line("application", app!.application_id)
  line("from stage", app!.current_stage_id)
  line("to stage", `${stage!.name} (${stage!.id})`)

  const originalStageId = app!.current_stage_id!

  // Any request left over from an earlier run would trip the one-live-request
  // constraint and return `already_exists` instead of firing.
  await db
    .from("interview_scheduling_requests")
    .delete()
    .eq("application_id", app!.application_id)

  // The stage is NOT reconfigured. It carries its real agent and inherits
  // `candidate_self_scheduling` from the cascade, so writing a config here would
  // both overwrite the assigned agent and test a fixture instead of the truth.
  // Resolve it and refuse to fire if the real config wouldn't.
  console.log("\nStage (as configured, not as staged)")
  const { resolveStageSchedulingConfig } = await import("@/lib/server/scheduling-config")
  const resolved = await resolveStageSchedulingConfig(db, stage!.id)
  if (resolved.kind !== "ok") {
    line("resolved", JSON.stringify(resolved))
    throw new Error("the stage does not resolve as self-scheduling — nothing would fire")
  }
  line("resource", JSON.stringify(resolved.config.resource))
  line("slot minutes", resolved.config.slotMinutes)
  line("minimum notice", `${resolved.config.minimumNoticeMinutes} min`)
  line("operating", `${resolved.config.operatingStartHour}–${resolved.config.operatingEndHour} ${resolved.config.operatingTimezone}`)

  // ── The real trigger path, exactly as a recruiter's move would run it ──────
  console.log("\nFire")
  const { moveApplicationToStage } = await import("@/lib/server/pipeline-commands")
  const moved = await moveApplicationToStage(db, {
    applicationId: app!.application_id,
    targetSubStageId: stage!.id,
    actor: { profileId: null, systemSource: "manual:booking-link-fire" },
  })
  line("move", moved.ok ? "ok" : `failed — ${moved.error}`)

  const { data: request } = await db
    .from("interview_scheduling_requests")
    .select("id, status, token_hash, token_expires_at, dispatched_to_n8n_at, slot_minutes, operating_timezone, failure_reason_code")
    .eq("application_id", app!.application_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!request) {
    console.log("  no scheduling request was created — the gate refused it")
  } else {
    line("request id", request.id)
    line("status", request.status)
    line("token stored", request.token_hash ? "hash only ✓" : "MISSING")
    line("dispatched to n8n", request.dispatched_to_n8n_at ?? "never")
    line("token expires", request.token_expires_at)
    line("slot minutes", request.slot_minutes)
    line("operating tz", request.operating_timezone)
    if (request.failure_reason_code) line("failure", request.failure_reason_code)
  }

  // ── Revert: only her position. The stage was never touched. ───────────────
  console.log("\nRevert")
  await db
    .from("applications")
    .update({ current_stage_id: originalStageId })
    .eq("application_id", app!.application_id)
  await db
    .from("application_stage_history")
    .delete()
    .eq("application_id", app!.application_id)
    .eq("sub_stage_id", stage!.id)
    .is("exited_at", null)
  await db
    .from("application_stage_history")
    .update({ exited_at: null, outcome: null, decided_by: null })
    .eq("application_id", app!.application_id)
    .eq("sub_stage_id", originalStageId)
  line("pipeline position", "back on the original stage")

  const keyBase = `${app!.application_id}:${stage!.id}`
  // `id`, not `event_id` — naming it wrong makes PostgREST reject the whole
  // request, and the delete reports 0 rows as though it had nothing to do.
  const { data: removed, error: removeErr } = await db
    .from("activity_events")
    .delete()
    .in("idempotency_key", [
      `candidate_leaves_stage:${keyBase}`,
      `candidate_advanced:${keyBase}`,
      `candidate_added_to_stage:${keyBase}`,
    ])
    .select("id")
  line("move events removed", removeErr ? `FAILED — ${removeErr.message}` : (removed?.length ?? 0))

  console.log(
    `\nLeft in place: the scheduling request${request ? ` ${request.id}` : ""} and its booking_link_sent event.\n`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
