"use server"

import { randomUUID } from "crypto"

import { revalidatePath } from "next/cache"

import { getCurrentProfile } from "@/lib/auth"
import { serverEnv } from "@/lib/env"
import {
  buildInterviewPrompt,
  formatQuestions,
  getInterviewAgentConfig,
} from "@/lib/interview-agent-config"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

type TriggerAgentCallResult = { ok: true } | { ok: false; error: string }

// E.164: leading +, country code 1-9, up to 15 digits total.
const E164_RE = /^\+[1-9]\d{7,14}$/

/**
 * Identity carried through to ElevenLabs as dynamic variables, so the
 * post-call webhook can echo it back and `call_recordings` rows can be written
 * with real foreign keys instead of being matched on a candidate's name.
 * `*_id` fields are null for test runs, which have no real application behind
 * them; `agent_id` is always set, since a call is always placed *by* an agent.
 */
type CallDispatchPayload = {
  to_number: string
  agent_id: string
  agent_name: string
  external_agent_id: string | null
  is_test: boolean
  application_id: string | null
  candidate_id: string | null
  candidate_name: string
  job_id: string | null
  job_title: string
  client_id: string | null
  sub_stage_id: string | null
  campaign_id: string
  idempotency_key: string
  // Interview content from `src/lib/interview-agent-config.ts`, matching what
  // the browser room sends. n8n forwards these to ElevenLabs as dynamic
  // variables, so a prompt referencing `{{questions}}` behaves the same over
  // the phone as it does in the room.
  interview_name: string
  agent_display_name: string
  company_name: string
  /** Numbered, newline-separated — ready to drop into a prompt as-is. */
  questions: string
  question_count: number
  /** Non-null only for agents that opted into prompt overrides *and* have the
   * matching flag enabled in ElevenLabs. n8n should pass it through as
   * `conversation_config_override.agent.prompt.prompt`, and omit the override
   * block entirely when null — sending an unpermitted override fails the call. */
  prompt_override: string | null
  first_message_override: string | null
}

/** Interview content for a dispatch, with fallbacks for an agent that has no
 * fixture entry yet. */
function interviewFieldsFor(agentId: string, agentName: string, candidateName: string) {
  const config = getInterviewAgentConfig(agentId)
  return {
    interview_name: config?.interviewName ?? agentName,
    agent_display_name: config?.agentDisplayName ?? agentName,
    company_name: config?.companyName ?? "Stella Force",
    questions: config ? formatQuestions(config.questions) : "",
    question_count: config?.questions.length ?? 0,
    prompt_override:
      config?.allowPromptOverride ? buildInterviewPrompt(config, candidateName) : null,
    // Null unless a config explicitly overrides it — the ElevenLabs agent's own
    // first message is templated with the dynamic variables above and already
    // differentiates per interview.
    first_message_override: config?.allowPromptOverride
      ? (config.firstMessage ?? null)
      : null,
  }
}

async function dispatchCall(payload: CallDispatchPayload): Promise<TriggerAgentCallResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(serverEnv.n8nVoiceTestCallWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverEnv.n8nWebhookSecret}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))
    if (!response.ok) {
      const body = await response.text()
      return {
        ok: false,
        error: `Call failed (n8n returned ${response.status}). ${body.slice(0, 200)}`,
      }
    }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Could not reach the calling service: ${err.message}`
          : "Could not reach the calling service.",
    }
  }
  return { ok: true }
}

/**
 * Screening-agent "test run" — places a one-off outbound call to a phone
 * number the recruiter supplies, using a dummy candidate identity (this is a
 * test of the agent's voice script, not a real screen). Only `agent_id` is a
 * real foreign key; there's no application/candidate/job behind a test call,
 * which is what `is_test` on the resulting `call_recordings` row records.
 */
export async function triggerAgentTestCall(
  agentId: string,
  toNumber: string
): Promise<TriggerAgentCallResult> {
  const profile = await getCurrentProfile()
  if (!profile) {
    return { ok: false, error: "You must be signed in to run a test call." }
  }

  if (!E164_RE.test(toNumber)) {
    return { ok: false, error: "Enter a valid phone number, e.g. +12065551234." }
  }

  const supabase = await createClient()
  const { data: agent } = await supabase
    .from("agents")
    .select("id, name, external_agent_id")
    .eq("id", agentId)
    .maybeSingle()

  if (!agent) return { ok: false, error: "That screening agent no longer exists." }

  const campaignId = randomUUID()
  return dispatchCall({
    to_number: toNumber,
    agent_id: agent.id,
    agent_name: agent.name,
    external_agent_id: agent.external_agent_id,
    is_test: true,
    application_id: null,
    candidate_id: null,
    candidate_name: "Jane Doe",
    job_id: null,
    job_title: "Test Screening Call",
    client_id: null,
    sub_stage_id: null,
    campaign_id: campaignId,
    idempotency_key: `${campaignId}:test:attempt_1`,
    ...interviewFieldsFor(agent.id, agent.name, "Jane Doe"),
  })
}

/**
 * Real screening call for a candidate on a job. Every identity field is
 * resolved from the application here — not reconstructed from names in the
 * webhook — so the `call_recordings` row the post-call webhook writes can
 * carry real foreign keys.
 *
 * No UI triggers this yet; it exists so the dispatch payload contract is the
 * same for both paths.
 */
export async function triggerApplicationScreeningCall(
  applicationId: string,
  agentId: string,
  subStageId: string | null
): Promise<TriggerAgentCallResult> {
  const profile = await getCurrentProfile()
  if (!profile) {
    return { ok: false, error: "You must be signed in to start a screening call." }
  }

  const supabase = await createClient()

  const [{ data: application }, { data: agent }] = await Promise.all([
    supabase
      .from("applications")
      .select(
        "application_id, candidate_id, job_id, candidate:candidates(full_name, first_name, last_name, phone), job:job_orders(title, client_id)"
      )
      .eq("application_id", applicationId)
      .maybeSingle(),
    supabase.from("agents").select("id, name, external_agent_id").eq("id", agentId).maybeSingle(),
  ])

  if (!application) return { ok: false, error: "That application no longer exists." }
  if (!agent) return { ok: false, error: "That screening agent no longer exists." }

  const candidate = application.candidate as {
    full_name: string | null
    first_name: string
    last_name: string
    phone: string | null
  } | null
  const job = application.job as { title: string; client_id: string } | null

  const toNumber = candidate?.phone?.trim()
  if (!toNumber || !E164_RE.test(toNumber)) {
    return {
      ok: false,
      error: "This candidate has no valid phone number on file (E.164, e.g. +12065551234).",
    }
  }

  const campaignId = randomUUID()
  const candidateName =
    candidate?.full_name?.trim() ||
    `${candidate?.first_name ?? ""} ${candidate?.last_name ?? ""}`.trim()

  return dispatchCall({
    to_number: toNumber,
    agent_id: agent.id,
    agent_name: agent.name,
    external_agent_id: agent.external_agent_id,
    is_test: false,
    application_id: application.application_id,
    candidate_id: application.candidate_id,
    candidate_name: candidateName,
    job_id: application.job_id,
    job_title: job?.title ?? "",
    client_id: job?.client_id ?? null,
    sub_stage_id: subStageId,
    campaign_id: campaignId,
    idempotency_key: `${campaignId}:${application.application_id}:attempt_1`,
    ...interviewFieldsFor(agent.id, agent.name, candidateName),
  })
}

type DeleteConversationsResult =
  | { ok: true; deletedRows: number; deletedObjects: number }
  | { ok: false; error: string }

/**
 * Permanently deletes conversations — the `call_recordings` rows *and* the
 * media they own in both buckets.
 *
 * **Bytes are deleted before rows, deliberately.** If the object delete fails we
 * abort and leave the rows intact, so the whole thing stays retryable. The
 * reverse order risks the worse outcome: rows gone, recordings stranded in
 * Storage with nothing referencing them — an invisible, unrecoverable leak of a
 * candidate's voice and likeness, which is precisely what "delete" was meant to
 * remove.
 *
 * Restricted to Stellaforce-side users. Client-side profiles can read their own
 * recordings but must not be able to destroy the hiring record.
 */
export async function deleteConversations(
  conversationIds: string[]
): Promise<DeleteConversationsResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "You must be signed in to delete conversations." }
  if (profile.side !== "stellaforce") {
    return { ok: false, error: "Only Stellaforce users can delete conversations." }
  }

  const ids = [...new Set(conversationIds.filter(Boolean))]
  if (ids.length === 0) return { ok: false, error: "No conversations selected." }

  // Service-role: this is a privileged destructive operation, and the storage
  // deletes must not be at the mercy of per-bucket RLS nuances.
  const admin = createAdminClient()

  const { data: rows, error: fetchError } = await admin
    .from("call_recordings")
    .select("id, storage_path, video_storage_path")
    .in("id", ids)

  if (fetchError) {
    return { ok: false, error: `Could not load those conversations: ${fetchError.message}` }
  }
  if (!rows || rows.length === 0) {
    return { ok: false, error: "Those conversations no longer exist." }
  }

  const audioPaths = rows.map((r) => r.storage_path).filter((p): p is string => !!p)
  const videoPaths = rows.map((r) => r.video_storage_path).filter((p): p is string => !!p)

  const removals = await Promise.all([
    audioPaths.length
      ? admin.storage.from("call-recordings").remove(audioPaths)
      : Promise.resolve({ error: null }),
    videoPaths.length
      ? admin.storage.from("video-recordings").remove(videoPaths)
      : Promise.resolve({ error: null }),
  ])

  const removalError = removals.find((r) => r.error)?.error
  if (removalError) {
    return {
      ok: false,
      error: `Could not delete the recordings, so nothing was removed: ${removalError.message}`,
    }
  }

  const { error: deleteError } = await admin.from("call_recordings").delete().in("id", ids)
  if (deleteError) {
    return {
      ok: false,
      error: `Recordings were deleted but the rows were not: ${deleteError.message}`,
    }
  }

  revalidatePath("/agents/conversations")
  return {
    ok: true,
    deletedRows: rows.length,
    deletedObjects: audioPaths.length + videoPaths.length,
  }
}
