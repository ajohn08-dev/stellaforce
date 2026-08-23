import "server-only"

import { resolveWorkflowSettingsWithClient } from "@/lib/workflow-settings"
import {
  SchedulingConfigError,
  schedulingRuntimeFrom,
  type SchedulingRuntime,
} from "@/lib/scheduling-runtime"
import type { StoredSchedulingPolicy } from "@/lib/scheduling-policy"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "@/lib/supabase/types"

/**
 * Resolving the scheduling settings for one sub-stage, and freezing them.
 *
 * The cascade is the app's existing one — `workflow_settings` category
 * `'scheduling'` at global → client → workflow, then the sub-stage's own
 * `config.scheduling` override. `scheduling_mode` is the exception: it is a
 * typed column on the sub-stage, because it is the only field ever used in a
 * WHERE clause.
 *
 * The result is **snapshotted onto the scheduling request**, not read live. A
 * recruiter changing the stage's minimum notice while a candidate has the
 * booking page open must not invalidate their hold or move the grid under them
 * — the same reasoning that makes `publishJob` snapshot the workflow template.
 */

export type SchedulingConfigClient = SupabaseClient<Database>

/** Everything the booking engine needs about one self-scheduling stage. */
export type StageSchedulingConfig = SchedulingRuntime & {
  subStageId: string
  jobId: string
  clientId: string
  agentId: string
  /** The interview length, from the stage; falls back to 30 minutes. */
  slotMinutes: number
  /** `least(stage setting, agents.max_concurrent_calls)` — see below. */
  agentConcurrencyLimit: number
  stageName: string
  jobTitle: string
  format: Database["public"]["Enums"]["stage_format"] | null
}

/** Why a stage is not a self-scheduling agent stage. Not an error — most aren't. */
export type NotApplicableReason =
  | "not_an_ai_stage"
  | "no_agent_assigned"
  /** An agent IS assigned, but it has been switched off. A different problem. */
  | "agent_inactive"
  | "not_automatic_entry"
  | "not_self_scheduling"
  | "scheduling_disabled"

export type StageSchedulingResult =
  | { kind: "ok"; config: StageSchedulingConfig }
  | { kind: "not_applicable"; reason: NotApplicableReason }
  | { kind: "invalid"; settingKey: string; value: string }

const DEFAULT_SLOT_MINUTES = 30

/**
 * Is this stage one that sends candidates a booking link, and if so with what
 * settings?
 *
 * The five applicability conditions are checked **before** the automation gate
 * and are deliberately separate from it. "This stage doesn't self-schedule" is
 * not a policy decision and must emit nothing — conflating it with "an
 * automation is paused" would put a skip event on every non-interview stage of
 * every pipeline, and the one that matters would be lost among them.
 */
export async function resolveStageSchedulingConfig(
  supabase: SchedulingConfigClient,
  subStageId: string
): Promise<StageSchedulingResult> {
  const { data: stage } = await supabase
    .from("job_workflow_sub_stages")
    .select(
      "id, job_id, name, agent_id, interviewer_type, entry_conditions, scheduling_mode, duration_minutes, format, config"
    )
    .eq("id", subStageId)
    .maybeSingle()

  if (!stage) return { kind: "not_applicable", reason: "not_an_ai_stage" }
  if (stage.interviewer_type !== "ai") {
    return { kind: "not_applicable", reason: "not_an_ai_stage" }
  }
  if (!stage.agent_id) return { kind: "not_applicable", reason: "no_agent_assigned" }
  if (!(stage.entry_conditions ?? []).includes("automatic")) {
    return { kind: "not_applicable", reason: "not_automatic_entry" }
  }

  const { data: job } = await supabase
    .from("job_orders")
    .select("job_id, title, client_id, workflow_template_id")
    .eq("job_id", stage.job_id)
    .maybeSingle()
  if (!job) return { kind: "not_applicable", reason: "not_an_ai_stage" }

  // The stage's own override, then the cascade above it.
  const stageConfig = (stage.config ?? {}) as { scheduling?: StoredSchedulingPolicy }
  const stagePolicy = stageConfig.scheduling

  const { settings } = await resolveWorkflowSettingsWithClient(supabase, {
    clientId: job.client_id,
    templateId: job.workflow_template_id,
    jobId: job.job_id,
  })
  const cascadePolicy = schedulingPolicyFromSettings(settings.scheduling)

  // `scheduling_mode` is the typed column; NULL inherits the cascade's mode.
  // The seeded global row spells the key `scheduling_policy` while the app's
  // shape says `mode` — both are read, so neither can be "fixed" into breaking
  // the other.
  const effectiveMode = stage.scheduling_mode ?? cascadePolicy.mode
  if (effectiveMode !== "candidate_self_scheduling") {
    return { kind: "not_applicable", reason: "not_self_scheduling" }
  }
  if (stagePolicy?.enabled === false || cascadePolicy.enabled === false) {
    return { kind: "not_applicable", reason: "scheduling_disabled" }
  }

  const merged: StoredSchedulingPolicy = {
    enabled: stagePolicy?.enabled ?? cascadePolicy.enabled,
    mode: effectiveMode,
    settings: { ...cascadePolicy.settings, ...stagePolicy?.settings },
  }

  let runtime: SchedulingRuntime
  try {
    runtime = schedulingRuntimeFrom(merged)
  } catch (err) {
    if (err instanceof SchedulingConfigError) {
      return { kind: "invalid", settingKey: err.settingKey, value: err.value }
    }
    throw err
  }

  // Capacity belongs to the agent: the voice provider refuses the N+1th
  // concurrent conversation regardless of which stage asked for it. A stage
  // number can only ever REDUCE it — two stages sharing one agent would
  // otherwise each claim the stage's number and together exceed the real limit.
  const { data: agent } = await supabase
    .from("agents")
    .select("id, max_concurrent_calls, status")
    .eq("id", stage.agent_id)
    .maybeSingle()
  if (!agent) return { kind: "not_applicable", reason: "no_agent_assigned" }
  if (agent.status !== "active") {
    // Distinct from "none assigned": someone chose this agent and someone else
    // turned it off, which is a configuration problem worth naming separately.
    return { kind: "not_applicable", reason: "agent_inactive" }
  }

  return {
    kind: "ok",
    config: {
      ...runtime,
      subStageId: stage.id,
      jobId: job.job_id,
      clientId: job.client_id,
      agentId: stage.agent_id,
      slotMinutes: stage.duration_minutes ?? DEFAULT_SLOT_MINUTES,
      agentConcurrencyLimit: Math.min(runtime.agentConcurrency, agent.max_concurrent_calls),
      stageName: stage.name,
      jobTitle: job.title,
      format: stage.format,
    },
  }
}

/**
 * The `workflow_settings` row for the `scheduling` category, as a policy.
 *
 * That seeded global row uses the key `scheduling_policy` for what the app calls
 * `mode` (`20260728100200_wf_settings.sql`). Both spellings are read here rather
 * than one being corrected, because correcting either would silently change the
 * effective mode for every existing workflow.
 */
function schedulingPolicyFromSettings(
  category: Record<string, Json> | undefined
): Required<Pick<StoredSchedulingPolicy, "enabled" | "settings">> & {
  mode: StoredSchedulingPolicy["mode"]
} {
  const raw = category ?? {}
  const legacyMode = raw.scheduling_policy
  const mode = raw.mode ?? legacyMode

  const settings: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (k === "mode" || k === "enabled" || k === "scheduling_policy") continue
    if (typeof v === "string") settings[k] = v
  }

  return {
    enabled: raw.enabled !== false,
    mode: typeof mode === "string" ? (mode as StoredSchedulingPolicy["mode"]) : undefined,
    settings,
  }
}
