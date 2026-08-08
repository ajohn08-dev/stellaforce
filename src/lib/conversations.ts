/**
 * Shared shapes + parsing for the Agent Conversations page, which reads from
 * `call_recordings` (the ElevenLabs post-call webhook's landing table).
 *
 * Kept separate from `data.ts` so the client components (table, detail sheet)
 * can import the types without pulling in the `server-only` data layer.
 */

export type ConversationTranscriptTurn = {
  speaker: "agent" | "candidate"
  text: string
}

export type Conversation = {
  conversation_id: string
  agent_name: string | null
  candidate_name: string | null
  /** The number the agent dialled — the candidate's for a real screen, the
   * recruiter-supplied one for a test run. E.164, kept as text so the leading
   * `+` and country code survive. */
  to_number: string | null
  /** Date-only slice of `started_at`, for formatDate. Null if the call never started. */
  started_on: string | null
  /** Full `started_at` timestamp — the detail sheet shows time-of-day, which
   * the date-only `started_on` slice throws away. */
  started_at: string | null
  duration_seconds: number | null
  is_test_call: boolean
  transcript: ConversationTranscriptTurn[]
  /** Playable media for the call. `audio_url` is a short-lived signed URL —
   * the `call-recordings` bucket is private, so the raw storage path isn't
   * fetchable from the browser. `video_url` is a plain external link (video
   * isn't owned/stored by us the way audio is). */
  audio_url: string | null
  audio_status: AudioStatus
  audio_mime_type: string | null
  video_url: string | null
}

/** Mirrors the `audio_status` CHECK on call_recordings. `pending` means the
 * transcript webhook landed but the audio payload hasn't been processed yet —
 * the two arrive as separate deliveries. */
export type AudioStatus = "pending" | "uploaded" | "failed"

/**
 * ElevenLabs sends the transcript as one flattened string of
 * "Agent: …\n\nCandidate: …" turns (that flattening happens in the n8n
 * mapping node, which joins the structured turn array). The jsonb
 * `transcript` column is reserved for the structured turns if we ever store
 * them directly; until then this reconstructs turns from the text so the
 * detail sheet can render them as a conversation rather than a wall of text.
 */
export function parseTranscriptText(text: string | null): ConversationTranscriptTurn[] {
  if (!text?.trim()) return []

  const turns: ConversationTranscriptTurn[] = []
  for (const block of text.split(/\n\s*\n/)) {
    const line = block.trim()
    if (!line) continue

    const match = /^(Agent|Candidate)\s*:\s*([\s\S]*)$/i.exec(line)
    if (match) {
      turns.push({
        speaker: match[1].toLowerCase() === "agent" ? "agent" : "candidate",
        text: match[2].trim(),
      })
      continue
    }

    // No speaker prefix — treat it as a continuation of the previous turn so
    // nothing is silently dropped, or as an agent turn if it's the first block.
    const previous = turns.at(-1)
    if (previous) previous.text += `\n${line}`
    else turns.push({ speaker: "agent", text: line })
  }
  return turns
}
