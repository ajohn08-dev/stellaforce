import "server-only"

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/env"
import { SCHEDULING_REASONS, isSchedulingReasonCode } from "@/lib/scheduling-reason-codes"

/**
 * What the platform would have done while an account wasn't running automations.
 *
 * The ledger already exists — every skip writes an `automation_skipped_by_policy`
 * event — so this is a query, not a new store. That is the whole reason the
 * events are still written when an account is off: silence would have left
 * nothing to come back to.
 *
 * **Forward-only by default.** Turning automations back on sends nothing
 * retroactively; this list is how a person chooses, one at a time. A backlog of
 * calls and emails fired at candidates whose situation has moved on is worse
 * than the silence that preceded it.
 */

export type SkippedAction = {
  eventId: string
  occurredAt: string
  automationKey: string
  /** The recruiter-facing sentence for the reason code. */
  message: string
  candidateId: string | null
  candidateName: string | null
  jobId: string | null
  jobTitle: string | null
  applicationId: string | null
  subStageId: string | null
  stageName: string | null
  /**
   * False once the candidate has moved on from the stage the skip happened at.
   * Still listed — "this didn't happen" stays true and is worth seeing — but not
   * offered as work, because sending it now would invite them to an interview
   * for a stage they have left.
   */
  stillRelevant: boolean
}

export async function getSkippedActions(limit = 100): Promise<SkippedAction[]> {
  if (!isSupabaseConfigured) return []
  const supabase = await createClient()

  const { data } = await supabase
    .from("activity_events")
    // One string literal, not a concatenation: the client infers the row type
    // from the select at compile time, and anything it can't narrow to a
    // literal collapses the result to an error type.
    .select(
      "id, created_at, payload, candidate_id, job_id, application_id, sub_stage_id, candidate:candidates(full_name, first_name, last_name), job:job_orders(title), sub_stage:job_workflow_sub_stages(name), application:applications(current_stage_id, status)"
    )
    .eq("event_type", "automation_skipped_by_policy")
    .order("created_at", { ascending: false })
    .limit(limit)

  return (data ?? []).flatMap((row) => {
    const payload = (row.payload ?? {}) as Record<string, unknown>
    const code = payload.reason_code

    // Only account-switch skips. A rule a recruiter paused on one job is their
    // decision, and listing it here as unfinished work argues with it.
    if (code !== "ACCOUNT_AUTOMATIONS_OFF" && code !== "ACCOUNT_AUTOMATIONS_PAUSED") return []

    const candidate = row.candidate as {
      full_name: string | null
      first_name: string
      last_name: string
    } | null
    const application = row.application as {
      current_stage_id: string | null
      status: string
    } | null

    return [
      {
        eventId: row.id,
        occurredAt: row.created_at,
        automationKey: typeof payload.automation_key === "string" ? payload.automation_key : "",
        message: isSchedulingReasonCode(code)
          ? SCHEDULING_REASONS[code].message
          : "An automation was skipped.",
        candidateId: row.candidate_id,
        candidateName:
          candidate?.full_name ??
          (candidate ? `${candidate.first_name} ${candidate.last_name}`.trim() : null),
        jobId: row.job_id,
        jobTitle: (row.job as { title: string } | null)?.title ?? null,
        applicationId: row.application_id,
        subStageId: row.sub_stage_id,
        stageName: (row.sub_stage as { name: string } | null)?.name ?? null,
        stillRelevant:
          application?.status === "active" &&
          application.current_stage_id === row.sub_stage_id &&
          // Only this one has a manual path today; the others would need their
          // own override call site, and offering a button that does nothing is
          // worse than not offering one.
          payload.automation_key === "send_booking_link",
      },
    ]
  })
}
