import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

import { z } from "zod"

import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Receiver for ElevenLabs post-call webhooks.
 *
 * ElevenLabs delivers a conversation in **two separate payloads**:
 *   1. `post_call_transcription` — everything except audio. Creates the
 *      `call_recordings` row.
 *   2. `post_call_audio` — only `{agent_id, conversation_id, full_audio}`,
 *      base64 MP3. Updates that row with the stored object.
 *
 * Both are keyed on `elevenlabs_conversation_id` (unique), which makes the
 * whole thing idempotent under at-least-once delivery: a redelivered transcript
 * overwrites identical values, and redelivered audio re-uploads to the same
 * deterministic path.
 *
 * This is channel-agnostic on purpose. A browser interview-room conversation
 * and a Twilio phone screen arrive as the same event with the same shape — the
 * only difference is that a room call has no phone leg, so `to_number` is null.
 * See the "Interview channels" section of CLAUDE.md.
 */

const CALL_RECORDINGS_BUCKET = "call-recordings"

/** Matches the ElevenLabs JS SDK's own `constructEvent`. */
const SIGNATURE_TOLERANCE_MS = 30 * 60 * 1000

export type VerifyResult = { ok: true; body: unknown } | { ok: false; error: string }

/**
 * Verifies the `elevenlabs-signature` header: `t=<unix_seconds>,v0=<hex>`,
 * where the signed message is `${timestamp}.${rawBody}` under HMAC-SHA256.
 *
 * The raw body text must be passed exactly as received — re-serializing parsed
 * JSON changes key order and whitespace and will never match.
 */
export function verifyPostCallSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): VerifyResult {
  if (!signatureHeader) return { ok: false, error: "Missing elevenlabs-signature header." }

  const parts = signatureHeader.split(",")
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2)
  const signature = parts.find((p) => p.startsWith("v0="))

  if (!timestamp || !signature) {
    return { ok: false, error: "Signature header is missing the t= or v0= component." }
  }

  const sentAtMs = Number(timestamp) * 1000
  if (!Number.isFinite(sentAtMs) || sentAtMs < Date.now() - SIGNATURE_TOLERANCE_MS) {
    return { ok: false, error: "Signature timestamp is outside the tolerance window." }
  }

  const expected =
    "v0=" + createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")

  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "Signature does not match." }
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return { ok: false, error: "Body is not valid JSON." }
  }
  return { ok: true, body }
}

// ---------------------------------------------------------------------------
// Payload schemas — deliberately lenient. Unknown keys are stripped rather than
// rejected (ElevenLabs adds fields over time), and the untouched raw body is
// persisted to `raw_elevenlabs_payload` regardless, so nothing is ever lost to
// a schema that's behind.
// ---------------------------------------------------------------------------

const TranscriptTurnSchema = z.object({
  role: z.string().nullish(),
  message: z.string().nullish(),
  time_in_call_secs: z.number().nullish(),
})

const TranscriptionSchema = z.object({
  type: z.literal("post_call_transcription"),
  data: z.object({
    agent_id: z.string(),
    conversation_id: z.string(),
    status: z.string().nullish(),
    transcript: z.array(TranscriptTurnSchema).nullish(),
    metadata: z
      .object({
        start_time_unix_secs: z.number().nullish(),
        call_duration_secs: z.number().nullish(),
        termination_reason: z.string().nullish(),
        phone_call: z
          .object({
            external_number: z.string().nullish(),
            agent_number: z.string().nullish(),
          })
          .nullish(),
      })
      .nullish(),
    analysis: z
      .object({
        call_successful: z.string().nullish(),
        transcript_summary: z.string().nullish(),
        call_summary_title: z.string().nullish(),
      })
      .nullish(),
    conversation_initiation_client_data: z
      .object({ dynamic_variables: z.record(z.string(), z.unknown()).nullish() })
      .nullish(),
  }),
})

const AudioSchema = z.object({
  type: z.literal("post_call_audio"),
  data: z.object({
    agent_id: z.string().nullish(),
    conversation_id: z.string(),
    full_audio: z.string(),
  }),
})

export const PostCallPayloadSchema = z.discriminatedUnion("type", [
  TranscriptionSchema,
  AudioSchema,
])

export type PostCallPayload = z.infer<typeof PostCallPayloadSchema>

export type HandlerResult =
  | { ok: true; status: number; detail: string }
  | { ok: false; status: number; error: string }

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Dynamic variables arrive as strings from both channels, but "absent" is
 * spelled differently by each: the phone dispatch payload sends `null`, while
 * the interview room must send `""` because ElevenLabs' dynamic variables
 * cannot hold null. Both mean "no such id".
 */
function optionalId(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed === "" || trimmed === "null" ? null : trimmed
}

function optionalBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    if (value === "true") return true
    if (value === "false") return false
  }
  return null
}

/** The shape `parseTranscriptText` (src/lib/conversations.ts) expects, so the
 * Conversations page renders these turns without a second format to support. */
function flattenTranscript(
  turns: z.infer<typeof TranscriptTurnSchema>[]
): string {
  return turns
    .filter((t) => t.message?.trim())
    .map((t) => {
      const speaker = t.role === "user" ? "Candidate" : "Agent"
      return `${speaker}: ${t.message!.trim()}`
    })
    .join("\n\n")
}

/** Where a recording lives in the bucket. Mirrors the convention documented in
 * DB_Schema.md, which the storage RLS policies depend on — client-side users can
 * only read under `applications/{application_id}/...`, and have no access to
 * `test/...` at all. */
function storagePathFor(opts: {
  applicationId: string | null
  interviewerType: string
  conversationId: string
}): string {
  const file = `${Date.now()}-${opts.conversationId}.mp3`
  return opts.applicationId
    ? `applications/${opts.applicationId}/${opts.interviewerType}/${file}`
    : `test/${file}`
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/** Phase 1 — creates (or refreshes) the row. */
export async function handleTranscription(
  payload: z.infer<typeof TranscriptionSchema>,
  rawBody: unknown
): Promise<HandlerResult> {
  const d = payload.data
  const vars = d.conversation_initiation_client_data?.dynamic_variables ?? {}
  const admin = createAdminClient()

  // Prefer the agent uuid we passed through ourselves. The fallback covers
  // conversations started outside the app (ElevenLabs' own playground, batch
  // calls) and is deliberately non-unique: every `agents` row shares one
  // `external_agent_id`, since they are all views onto the single ElevenLabs
  // agent. So this picks the oldest match rather than using `.maybeSingle()`,
  // which would error on multiple rows and silently drop the agent entirely.
  let agentId = optionalId(vars.agent_id)
  if (!agentId) {
    const { data: agents } = await admin
      .from("agents")
      .select("id")
      .eq("external_agent_id", d.agent_id)
      .order("created_at", { ascending: true })
      .limit(1)
    agentId = agents?.[0]?.id ?? null
  }

  const applicationId = optionalId(vars.application_id)
  // `call_recordings` has a check constraint forbidding is_test with a real
  // application, and another requiring an agent when is_test — so a resolved
  // application always wins, and an unresolvable agent can't be a test row.
  const isTest = applicationId ? false : (optionalBool(vars.is_test) ?? !!agentId)

  if (isTest && !agentId) {
    return {
      ok: false,
      status: 422,
      error: `No agent registered for external_agent_id "${d.agent_id}" — cannot record a test call without one.`,
    }
  }

  const turns = (d.transcript ?? []).filter(Boolean)
  const startedAt = d.metadata?.start_time_unix_secs
    ? new Date(d.metadata.start_time_unix_secs * 1000).toISOString()
    : null

  const row = {
    elevenlabs_conversation_id: d.conversation_id,
    agent_id: agentId,
    application_id: applicationId,
    candidate_id: optionalId(vars.candidate_id),
    job_id: optionalId(vars.job_id),
    client_id: optionalId(vars.client_id),
    sub_stage_id: optionalId(vars.sub_stage_id),
    campaign_id: optionalId(vars.campaign_id),
    is_test: isTest,
    interviewer_type: "ai" as const,
    // Null for interview-room conversations — there is no phone leg. That
    // absence is itself the cheapest signal of which channel was used.
    to_number:
      d.metadata?.phone_call?.external_number ?? optionalId(vars.to_number) ?? null,
    started_at: startedAt,
    duration_seconds: d.metadata?.call_duration_secs ?? null,
    call_status: d.status ?? null,
    call_successful: d.analysis?.call_successful ?? null,
    title: d.analysis?.call_summary_title ?? null,
    summary: d.analysis?.transcript_summary ?? null,
    termination_reason: d.metadata?.termination_reason ?? null,
    transcript: turns,
    transcript_text: flattenTranscript(turns),
    transcript_status: "transcribed",
    raw_elevenlabs_payload: rawBody as never,
  }

  const { error } = await admin
    .from("call_recordings")
    .upsert(row, { onConflict: "elevenlabs_conversation_id" })

  if (error) {
    return { ok: false, status: 500, error: `Could not write call_recordings: ${error.message}` }
  }
  return {
    ok: true,
    status: 200,
    detail: `Recorded transcript for ${d.conversation_id} (${turns.length} turns).`,
  }
}

/** Phase 2 — stores the MP3 and links it to the row created by phase 1. */
export async function handleAudio(
  payload: z.infer<typeof AudioSchema>
): Promise<HandlerResult> {
  const { conversation_id: conversationId, full_audio: fullAudio } = payload.data
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from("call_recordings")
    .select("id, application_id, interviewer_type, storage_path")
    .eq("elevenlabs_conversation_id", conversationId)
    .maybeSingle()

  // Audio normally arrives second. If it somehow beats the transcript there's
  // no identity to derive a storage path from, so ask for redelivery rather
  // than filing the recording somewhere client users would be unable to read.
  // NOTE: this needs `retry_enabled` on the ElevenLabs webhook.
  if (!existing) {
    return {
      ok: false,
      status: 409,
      error: `No call_recordings row for ${conversationId} yet — transcript payload has not arrived. Retry this delivery.`,
    }
  }

  const audio = Buffer.from(fullAudio, "base64")
  if (audio.length === 0) {
    return { ok: false, status: 422, error: "Audio payload decoded to zero bytes." }
  }

  // Reuse the path on redelivery so the unique constraint on storage_path
  // can't trip over a second object for the same call.
  const path =
    existing.storage_path ??
    storagePathFor({
      applicationId: existing.application_id,
      interviewerType: existing.interviewer_type,
      conversationId,
    })

  const { error: uploadError } = await admin.storage
    .from(CALL_RECORDINGS_BUCKET)
    .upload(path, audio, { contentType: "audio/mpeg", upsert: true })

  if (uploadError) {
    await admin
      .from("call_recordings")
      .update({ audio_status: "failed" })
      .eq("id", existing.id)
    return { ok: false, status: 500, error: `Audio upload failed: ${uploadError.message}` }
  }

  const { error } = await admin
    .from("call_recordings")
    .update({
      storage_path: path,
      filename: path.split("/").pop() ?? null,
      mime_type: "audio/mpeg",
      file_size: audio.length,
      audio_status: "uploaded",
    })
    .eq("id", existing.id)

  if (error) {
    return { ok: false, status: 500, error: `Could not link audio: ${error.message}` }
  }
  return {
    ok: true,
    status: 200,
    detail: `Stored ${audio.length} bytes of audio for ${conversationId}.`,
  }
}
