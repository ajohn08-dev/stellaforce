import "server-only"

import { logActivity, type ActivityClient } from "@/lib/server/activity"
import { maybeCreateBookingRequest } from "@/lib/server/booking-request"

/**
 * The pipeline's domain commands — one implementation each, whoever is calling.
 *
 * A recruiter clicking "Move to stage", an n8n workflow reacting to a provider
 * webhook, and a future ATS integration must all produce the same rows and the
 * same events. So the logic lives here, taking the Supabase client and the actor
 * as arguments, and both the Server Actions (`src/app/(app)/jobs/actions.ts`)
 * and the bearer-authed routes (`src/app/api/…`) are thin wrappers over it.
 *
 * The alternative — a route that updates `applications` itself — is how two
 * paths end up writing different events for the same transition, and why n8n
 * must never touch these tables directly.
 */

export type CommandResult<T = unknown> = ({ ok: true } & T) | { ok: false; error: string }

export type CommandActor = {
  /** Null for a system caller (n8n, cron). Drives `actor_type` on the events. */
  profileId: string | null
  /** e.g. `'n8n:ats_sync'`. Only meaningful when `profileId` is null. */
  systemSource?: string | null
}

// ── Move an application to another sub-stage ────────────────────────────────

export async function moveApplicationToStage(
  supabase: ActivityClient,
  input: {
    applicationId: string
    targetSubStageId: string
    actor: CommandActor
    /**
     * Makes a redelivery a no-op. Without one, an A→B→A round trip reuses the
     * same key and the second arrival is silently swallowed — pass an external
     * event id when the caller has one.
     */
    idempotencyKey?: string
  }
): Promise<CommandResult<{ jobId: string; subStageId: string }>> {
  const { data: app } = await supabase
    .from("applications")
    .select("application_id, candidate_id, job_id, client_id, current_stage_id, status")
    .eq("application_id", input.applicationId)
    .maybeSingle()
  if (!app) return { ok: false, error: "Application not found." }
  if (app.status !== "active") return { ok: false, error: "This application is already closed." }

  // The target must belong to this job — otherwise a caller with a stage id from
  // another pipeline could move a candidate somewhere that means nothing.
  const { data: target } = await supabase
    .from("job_workflow_sub_stages")
    .select("id, display_order")
    .eq("id", input.targetSubStageId)
    .eq("job_id", app.job_id)
    .maybeSingle()
  if (!target) return { ok: false, error: "That stage is not part of this job's pipeline." }
  if (target.id === app.current_stage_id) {
    // Idempotent rather than an error: a redelivered webhook saying "they're in
    // stage B" when they already are is agreement, not a conflict.
    return { ok: true, jobId: app.job_id, subStageId: target.id }
  }

  await supabase
    .from("application_stage_history")
    .update({
      exited_at: new Date().toISOString(),
      outcome: "advance",
      decided_by: input.actor.profileId,
    })
    .eq("application_id", input.applicationId)
    .is("exited_at", null)

  await supabase
    .from("application_stage_history")
    .insert({ application_id: input.applicationId, sub_stage_id: input.targetSubStageId })

  await supabase
    .from("applications")
    .update({ current_stage_id: input.targetSubStageId })
    .eq("application_id", input.applicationId)

  const base = {
    client_id: app.client_id,
    candidate_id: app.candidate_id,
    job_id: app.job_id,
    application_id: input.applicationId,
    actor_type: (input.actor.profileId ? "user" : "system") as "user" | "system",
    actor_profile_id: input.actor.profileId,
    system_source: input.actor.profileId ? null : (input.actor.systemSource ?? "n8n:pipeline"),
  }
  const keyBase = input.idempotencyKey ?? `${input.applicationId}:${input.targetSubStageId}`

  await logActivity(supabase, {
    ...base,
    event_type: "candidate_leaves_stage",
    sub_stage_id: app.current_stage_id,
    idempotency_key: `candidate_leaves_stage:${keyBase}`,
  })
  await logActivity(supabase, {
    ...base,
    event_type: "candidate_advanced",
    sub_stage_id: input.targetSubStageId,
    severity: "action_needed",
    idempotency_key: `candidate_advanced:${keyBase}`,
  })
  await logActivity(supabase, {
    ...base,
    event_type: "candidate_added_to_stage",
    sub_stage_id: input.targetSubStageId,
    idempotency_key: `candidate_added_to_stage:${keyBase}`,
  })

  // Landing on a self-scheduling agent stage is what sends a booking link.
  // Deliberately after the move has committed and its events are written: this
  // never throws, and a link that couldn't be created must not undo a stage
  // change that already happened. Most stages aren't self-scheduling, in which
  // case it does nothing and logs nothing.
  await maybeCreateBookingRequest({
    applicationId: input.applicationId,
    subStageId: input.targetSubStageId,
    candidateId: app.candidate_id,
    jobId: app.job_id,
    clientId: app.client_id,
    correlationId: keyBase,
    createdBy: input.actor.profileId,
  })

  return { ok: true, jobId: app.job_id, subStageId: input.targetSubStageId }
}

// ── Mark an interview as having happened ────────────────────────────────────

/**
 * The first thing in this codebase ever to emit `interview_completed`. The enum
 * value has existed since the workflow-templates migration; nothing has written
 * it, so no consumer has ever been exercised.
 */
export async function completeInterviewCommand(
  supabase: ActivityClient,
  input: {
    interviewId: string
    outcome?: "completed" | "no_show"
    actor: CommandActor
  }
): Promise<CommandResult<{ jobId: string; alreadyDone: boolean }>> {
  const { data: interview } = await supabase
    .from("interviews")
    .select("id, status, application_id, candidate_id, job_id, client_id, sub_stage_id")
    .eq("id", input.interviewId)
    .maybeSingle()
  if (!interview) return { ok: false, error: "Interview not found." }

  // Idempotent: n8n retries, and a double-click is not a conflict.
  if (interview.status === "completed" || interview.status === "no_show") {
    return { ok: true, jobId: interview.job_id, alreadyDone: true }
  }
  if (interview.status === "canceled") {
    return { ok: false, error: "That interview was cancelled." }
  }

  const outcome = input.outcome ?? "completed"

  await supabase
    .from("interviews")
    .update({ status: outcome, completed_at: new Date().toISOString() })
    .eq("id", input.interviewId)

  // Nothing is left to dial once the interview has happened. Belt and braces —
  // the claim query already filters on `interviews.status = 'scheduled'`.
  await supabase
    .from("scheduled_agent_calls")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("interview_id", input.interviewId)
    .in("status", ["pending", "claimed"])

  const eventType = outcome === "no_show" ? "interview_no_show_candidate" : "interview_completed"

  await logActivity(supabase, {
    event_type: eventType,
    client_id: interview.client_id,
    candidate_id: interview.candidate_id,
    job_id: interview.job_id,
    application_id: interview.application_id,
    sub_stage_id: interview.sub_stage_id,
    actor_type: input.actor.profileId ? "user" : "system",
    actor_profile_id: input.actor.profileId,
    system_source: input.actor.profileId ? null : (input.actor.systemSource ?? "n8n:interviews"),
    severity: outcome === "no_show" ? "action_needed" : "info",
    payload: { interview_id: input.interviewId },
    idempotency_key: `${eventType}:${input.interviewId}`,
  })

  return { ok: true, jobId: interview.job_id, alreadyDone: false }
}
