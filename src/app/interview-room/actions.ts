"use server"

import { randomUUID } from "crypto"

import { getCurrentProfile } from "@/lib/auth"
import { serverEnv } from "@/lib/env"
import {
  buildInterviewPrompt,
  formatQuestions,
  getInterviewAgentConfig,
} from "@/lib/interview-agent-config"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

/**
 * The browser interview room talks to ElevenLabs **directly** — unlike the
 * phone test run (`src/app/(app)/agents/actions.ts`), which hands off to n8n to
 * place an outbound call. Only the token mint happens server-side, because it
 * needs the REST key.
 *
 * Both channels converge again after the call: ElevenLabs fires the same
 * `post_call_transcription` webhook either way, so a room conversation lands in
 * `call_recordings` as an ordinary `interviewer_type = 'ai'` row and shows up on
 * the Conversations page alongside phone calls with no extra plumbing.
 */

/** Mirrors the phone path's `CallDispatchPayload` field-for-field where the two
 * overlap, so the post-call webhook can write `call_recordings` from one shape
 * regardless of channel. `channel` is the only addition — it rides in
 * `raw_elevenlabs_payload` and is read back via `payloadDynamicVariable()`
 * (`src/lib/data.ts`), which is why telling the channels apart needs no column.
 *
 * Note the absent-value convention differs from the phone path by necessity:
 * ElevenLabs dynamic variables are `string | number | boolean` with no null, so
 * the id fields carry `""` where `CallDispatchPayload` carries `null`. The
 * webhook must therefore treat empty string as absent for these keys. Omitting
 * them entirely isn't an option — an agent prompt that interpolates a missing
 * variable errors at conversation start. */
type InterviewRoomVariables = {
  channel: "video_room"
  agent_id: string
  agent_name: string
  is_test: boolean
  application_id: string
  candidate_id: string
  candidate_name: string
  job_id: string
  job_title: string
  client_id: string
  sub_stage_id: string
  campaign_id: string
  // Interview content, from `src/lib/interview-agent-config.ts`. These only do
  // anything if the agent's own prompt in ElevenLabs references the matching
  // `{{placeholder}}` — sending them is free either way, and they also land in
  // `raw_elevenlabs_payload`, so a recording records what it was asked with.
  interview_name: string
  agent_display_name: string
  company_name: string
  questions: string
  question_count: number
}

/** Shape ElevenLabs accepts for a session-start override. Every field is
 * refused unless the matching flag is enabled on the agent. */
type InterviewOverrides = {
  agent?: { prompt?: { prompt?: string }; firstMessage?: string }
}

export type InterviewRoomSession =
  | {
      ok: true
      /** Prompt/first-message overrides, present only for agents that have
       * opted in *and* had the matching flags enabled in ElevenLabs. Undefined
       * otherwise — sending an unpermitted override fails the session. */
      overrides?: InterviewOverrides
      /** WebRTC credential — the preferred transport, best audio quality. */
      token: string | null
      /** WebSocket credential, used when WebRTC's UDP/SCTP media path is blocked
       * or degraded (corporate VPNs, restrictive firewalls, low tunnel MTUs).
       * Plain TCP:443, so it survives most middleboxes. */
      signedUrl: string | null
      dynamicVariables: InterviewRoomVariables
    }
  | {
      /** The room renders its full UI and explains the gap rather than failing
       * hard — `reason` picks which explanation. */
      ok: false
      reason: "unauthorized" | "not_found" | "not_configured" | "token_failed"
      error: string
    }

const TOKEN_ENDPOINT = "https://api.elevenlabs.io/v1/convai/conversation/token"
const SIGNED_URL_ENDPOINT = "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url"
const CONVERSATION_ENDPOINT = "https://api.elevenlabs.io/v1/convai/conversations"

/**
 * Why a conversation actually ended, straight from ElevenLabs.
 *
 * The browser SDK reports server-side terminations as "Server error: Unknown
 * error", which is useless to whoever is looking at the screen — a blown quota,
 * a misconfigured agent, and a genuine outage all look identical. ElevenLabs
 * records the real reason against the conversation, so we fetch it and say it
 * out loud. Returns null if it can't be determined; callers fall back to
 * whatever the SDK gave them.
 */
export async function getInterviewRoomFailureReason(
  conversationId: string
): Promise<string | null> {
  const profile = await getCurrentProfile()
  if (!profile) return null

  const apiKey = serverEnv.elevenlabsApiKey
  if (!apiKey || !conversationId) return null

  try {
    const data = await fetchJson<{
      status?: unknown
      metadata?: { termination_reason?: unknown; error?: { reason?: unknown } }
    }>(`${CONVERSATION_ENDPOINT}/${encodeURIComponent(conversationId)}`, apiKey)

    if (data.status !== "failed") return null

    const reason =
      (typeof data.metadata?.error?.reason === "string" && data.metadata.error.reason) ||
      (typeof data.metadata?.termination_reason === "string" &&
        data.metadata.termination_reason) ||
      null
    return reason || null
  } catch {
    // Diagnostics must never be the thing that breaks the screen.
    return null
  }
}

/** Video lives in its own bucket, not alongside audio — see the
 * `video_recordings_bucket` migration for why (size limit, retention clock, and
 * access surface all differ). The `call_recordings` row still ties them
 * together via `video_storage_path`. */
const VIDEO_RECORDINGS_BUCKET = "video-recordings"

/** Extension the bucket + players expect, from what MediaRecorder produced. */
function videoExtension(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4"
  if (mimeType.includes("matroska")) return "mkv"
  return "webm"
}

/**
 * Issues a one-off signed upload URL for a candidate's interview video.
 *
 * The browser uploads **directly to Storage** rather than POSTing the file to
 * us: recordings run to tens of megabytes, which no Server Action body should
 * carry, and a signed URL also works for a future candidate who has no login at
 * all — unlike the bucket's `profiles.side = 'stellaforce'` RLS policy.
 */
export async function createInterviewVideoUpload(
  conversationId: string,
  mimeType: string
): Promise<
  { ok: true; path: string; token: string } | { ok: false; error: string }
> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }
  if (!conversationId) return { ok: false, error: "No conversation to attach video to." }

  const admin = createAdminClient()

  // Prefer the identity the post-call webhook already resolved, so the object
  // lands under the prefix the storage RLS policies expect. The webhook often
  // hasn't arrived yet, in which case this is a test-bench run anyway.
  const { data: existing } = await admin
    .from("call_recordings")
    .select("application_id, interviewer_type")
    .eq("elevenlabs_conversation_id", conversationId)
    .maybeSingle()

  const file = `${Date.now()}-${conversationId}.${videoExtension(mimeType)}`
  const path = existing?.application_id
    ? `applications/${existing.application_id}/${existing.interviewer_type}/${file}`
    : `test/${file}`

  const { data, error } = await admin.storage
    .from(VIDEO_RECORDINGS_BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    return { ok: false, error: `Could not prepare video upload: ${error?.message ?? "unknown"}` }
  }
  return { ok: true, path: data.path, token: data.token }
}

/**
 * Links an uploaded video onto its `call_recordings` row.
 *
 * Upserts rather than updates because the browser usually finishes uploading
 * before ElevenLabs' post-call webhook lands. Writing a stub keyed by
 * `elevenlabs_conversation_id` lets the transcript payload merge into the same
 * row afterwards — PostgREST's on-conflict update only touches the columns in
 * each payload, so neither writer clobbers the other's.
 */
export async function finalizeInterviewVideo(input: {
  conversationId: string
  path: string
  sizeBytes: number
  mimeType: string
  durationSeconds: number
  status: "uploaded" | "failed"
}): Promise<{ ok: boolean; error?: string }> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, error: "Not signed in." }

  const admin = createAdminClient()
  const { error } = await admin.from("call_recordings").upsert(
    {
      elevenlabs_conversation_id: input.conversationId,
      // NOT NULL on the table, and always true here — a room interview is
      // AI-conducted by definition.
      interviewer_type: "ai",
      video_storage_path: input.path,
      video_filename: input.path.split("/").pop() ?? null,
      video_mime_type: input.mimeType,
      video_file_size: input.sizeBytes,
      video_duration_seconds: input.durationSeconds,
      video_status: input.status,
    },
    { onConflict: "elevenlabs_conversation_id" }
  )

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Throws a message already fit to show a user — callers surface it verbatim. */
async function fetchJson<T>(url: string, apiKey: string): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  let response: Response
  try {
    response = await fetch(url, {
      headers: { "xi-api-key": apiKey },
      signal: controller.signal,
    })
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? `Could not reach ElevenLabs: ${err.message}`
        : "Could not reach ElevenLabs."
    )
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `ElevenLabs refused the session (${response.status}). ${body.slice(0, 200)}`
    )
  }
  return (await response.json()) as T
}

/**
 * Mints short-lived ElevenLabs client credentials for a browser interview room.
 *
 * This is the test-bench path: a recruiter opening the room from the Agents
 * page, with a dummy candidate identity and `is_test: true` — the same
 * convention `triggerAgentTestCall` uses. The production path (a real candidate
 * arriving via an emailed session code) will reuse this function with real
 * application identity once the invite flow exists.
 */
export async function createInterviewRoomSession(
  agentId: string
): Promise<InterviewRoomSession> {
  const profile = await getCurrentProfile()
  if (!profile) {
    return {
      ok: false,
      reason: "unauthorized",
      error: "You must be signed in to open an interview room.",
    }
  }

  const supabase = await createClient()
  const { data: agent } = await supabase
    .from("agents")
    .select("id, name, external_agent_id")
    .eq("id", agentId)
    .maybeSingle()

  if (!agent) {
    return { ok: false, reason: "not_found", error: "That screening agent no longer exists." }
  }

  // Two independent prerequisites, reported separately — "add the key" and
  // "create this agent in ElevenLabs" are different jobs for whoever is reading.
  const apiKey = serverEnv.elevenlabsApiKey
  if (!apiKey) {
    return {
      ok: false,
      reason: "not_configured",
      error:
        "ELEVENLABS_API_KEY isn't set on the server, so no interview session can be started yet.",
    }
  }
  if (!agent.external_agent_id) {
    return {
      ok: false,
      reason: "not_configured",
      error: `"${agent.name}" hasn't been created in ElevenLabs yet — it has no external agent ID to connect to.`,
    }
  }

  const externalId = encodeURIComponent(agent.external_agent_id)

  // Both credentials are minted up front, in parallel, so the browser can fall
  // back from WebRTC to WebSocket mid-session without a second round trip (and
  // without a user gesture to spend on one).
  const [tokenResult, signedUrlResult] = await Promise.allSettled([
    fetchJson<{ token?: unknown }>(`${TOKEN_ENDPOINT}?agent_id=${externalId}`, apiKey),
    fetchJson<{ signed_url?: unknown }>(
      `${SIGNED_URL_ENDPOINT}?agent_id=${externalId}`,
      apiKey
    ),
  ])

  // Either credential is sufficient to hold an interview, so only a failure of
  // *both* is fatal. This matters in practice: the two endpoints rate-limit
  // independently, and WebRTC is also the one likelier to be blocked outright.
  const token =
    tokenResult.status === "fulfilled" && typeof tokenResult.value.token === "string"
      ? tokenResult.value.token
      : null
  const signedUrl =
    signedUrlResult.status === "fulfilled" &&
    typeof signedUrlResult.value.signed_url === "string"
      ? signedUrlResult.value.signed_url
      : null

  if (!token && !signedUrl) {
    const why =
      tokenResult.status === "rejected"
        ? String(tokenResult.reason).replace(/^Error:\s*/, "")
        : "ElevenLabs returned no usable session credentials."
    return { ok: false, reason: "token_failed", error: why }
  }

  // Interview content for this agent. Falls back to the agent row's own name
  // and an empty question set, so an agent with no fixture still runs — it just
  // uses whatever prompt it already has in ElevenLabs.
  const config = getInterviewAgentConfig(agent.id)
  const candidateName = "Jane Doe"

  const overrides: InterviewOverrides | undefined = config?.allowPromptOverride
    ? {
        agent: {
          prompt: { prompt: buildInterviewPrompt(config, candidateName) },
          ...(config.firstMessage ? { firstMessage: config.firstMessage } : {}),
        },
      }
    : undefined

  return {
    ok: true,
    token,
    signedUrl,
    overrides,
    dynamicVariables: {
      channel: "video_room",
      agent_id: agent.id,
      agent_name: agent.name,
      is_test: true,
      application_id: "",
      candidate_id: "",
      candidate_name: candidateName,
      job_id: "",
      job_title: config?.interviewName ?? "Test Video Interview",
      client_id: "",
      sub_stage_id: "",
      campaign_id: randomUUID(),
      interview_name: config?.interviewName ?? agent.name,
      agent_display_name: config?.agentDisplayName ?? agent.name,
      company_name: config?.companyName ?? "Stella Force",
      questions: config ? formatQuestions(config.questions) : "",
      question_count: config?.questions.length ?? 0,
    },
  }
}
