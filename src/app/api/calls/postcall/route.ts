import { NextRequest, NextResponse } from "next/server"

import { serverEnv } from "@/lib/env"
import {
  PostCallPayloadSchema,
  handleAudio,
  handleTranscription,
  verifyPostCallSignature,
} from "@/lib/server/elevenlabs-postcall"

/**
 * POST /api/calls/postcall
 *
 * Inbound ElevenLabs post-call webhook. Configure it in the ElevenLabs
 * workspace (Webhooks → post-call) pointing at `${SITE_URL}/api/calls/postcall`
 * with HMAC auth, and put the generated signing secret in
 * `ELEVENLABS_POSTCALL_WEBHOOK_SECRET`.
 *
 * Handles both conversation channels — browser interview room and Twilio phone
 * screen — because ElevenLabs emits the same event for both. Enable **both**
 * the transcript and audio events on the webhook, and turn on retries: a 409
 * here means "audio arrived before its transcript, send it again", and without
 * retries that recording is lost for good.
 *
 * Writes use the service-role client (`createAdminClient`): this is a
 * privileged, unauthenticated callback with no acting user session, the same
 * reasoning as the resume-ingestion route.
 */

export const runtime = "nodejs"

export async function POST(req: NextRequest): Promise<NextResponse> {
  // The raw text, not a re-serialized object — HMAC is computed over the exact
  // bytes ElevenLabs sent, so key order and whitespace matter.
  const rawBody = await req.text()

  const verified = verifyPostCallSignature(
    rawBody,
    req.headers.get("elevenlabs-signature"),
    serverEnv.elevenlabsPostcallWebhookSecret
  )
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.error }, { status: 401 })
  }

  const parsed = PostCallPayloadSchema.safeParse(verified.body)
  if (!parsed.success) {
    // 200, not 4xx: an event type we don't handle is not a delivery failure,
    // and returning an error would make ElevenLabs retry it forever.
    return NextResponse.json(
      { ok: true, detail: "Ignored unrecognized post-call payload." },
      { status: 200 }
    )
  }

  const result =
    parsed.data.type === "post_call_transcription"
      ? await handleTranscription(parsed.data, verified.body)
      : await handleAudio(parsed.data)

  if (!result.ok) {
    console.error("[postcall]", result.error)
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true, detail: result.detail }, { status: result.status })
}
