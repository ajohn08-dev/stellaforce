"use client"

import type { Conversation } from "@/lib/conversations"

/**
 * Media for a single call, shown above the transcript in the detail sheet.
 * Video-capable stages carry a plain `video_url`; everything else is a phone
 * screen, whose recording we own in the private `call-recordings` bucket and
 * therefore serve through a signed URL.
 *
 * Native <audio>/<video> controls rather than a custom player: the browser's
 * own controls already handle scrubbing, volume, and playback rate
 * accessibly, and there's no product reason yet to reimplement them.
 */
export function ConversationMediaPreview({
  conversation,
}: {
  conversation: Conversation
}) {
  const { video_url, audio_url, audio_status, audio_mime_type } = conversation

  if (video_url) {
    return (
      <video
        controls
        preload="metadata"
        src={video_url}
        className="w-full rounded-lg border border-border bg-black"
      />
    )
  }

  if (audio_url) {
    return (
      <audio controls preload="metadata" className="w-full">
        <source src={audio_url} type={audio_mime_type ?? undefined} />
        Your browser doesn&rsquo;t support audio playback.
      </audio>
    )
  }

  // No playable media — say which of the two reasons it is, since "still
  // processing" and "the upload failed" need different follow-up.
  const message =
    audio_status === "failed"
      ? "Recording unavailable — the audio upload failed."
      : audio_status === "pending"
        ? "Recording is still processing."
        : "No recording for this call."

  return (
    <p className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
      {message}
    </p>
  )
}
