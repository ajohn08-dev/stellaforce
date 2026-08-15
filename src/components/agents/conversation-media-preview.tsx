"use client"

import { SyncedInterviewPlayer } from "@/components/agents/synced-interview-player"
import type { Conversation } from "@/lib/conversations"

/**
 * Media for a single call, shown above the transcript in the detail sheet.
 *
 * Three shapes, by what the call actually produced: a third-party stage carries
 * a plain external `video_url`; a browser interview room has both a candidate
 * video and conversation audio, which play as one via `SyncedInterviewPlayer`;
 * a phone screen has audio only.
 *
 * Native controls everywhere except the paired case — the browser's own already
 * handle scrubbing, volume, and playback rate accessibly, and are only worth
 * replacing when two media elements have to share a single timeline.
 */
export function ConversationMediaPreview({
  conversation,
}: {
  conversation: Conversation
}) {
  const {
    video_url,
    audio_url,
    audio_status,
    audio_mime_type,
    candidate_video_url,
    candidate_video_status,
    candidate_video_mime_type,
  } = conversation

  // Externally-hosted recording — self-contained, nothing of ours to pair it with.
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

  // The video-interview case: one picture, one transport.
  if (candidate_video_url && audio_url) {
    return (
      <SyncedInterviewPlayer
        videoUrl={candidate_video_url}
        videoMimeType={candidate_video_mime_type}
        audioUrl={audio_url}
        audioMimeType={audio_mime_type}
      />
    )
  }

  // Video arrived but its audio hasn't (the post-call webhook lands separately),
  // so the video carries its own controls until the pair is complete.
  if (candidate_video_url) {
    return (
      <div className="flex flex-col gap-2">
        <video
          controls
          muted
          playsInline
          preload="metadata"
          className="aspect-video w-full rounded-lg border border-border bg-black object-contain"
        >
          <source src={candidate_video_url} type={candidate_video_mime_type ?? undefined} />
        </video>
        <p className="text-xs text-muted-foreground">
          Candidate camera — no sound.{" "}
          {audio_status === "failed"
            ? "The conversation audio failed to upload."
            : "The conversation audio is still processing."}
        </p>
      </div>
    )
  }

  if (audio_url) {
    return (
      <div className="flex flex-col gap-2">
        <audio controls preload="metadata" className="w-full">
          <source src={audio_url} type={audio_mime_type ?? undefined} />
          Your browser doesn&rsquo;t support audio playback.
        </audio>
        {candidate_video_status === "failed" && (
          <p className="text-xs text-muted-foreground">
            The candidate&rsquo;s video could not be saved.
          </p>
        )}
      </div>
    )
  }

  // Nothing playable — say which of the reasons it is, since "still processing"
  // and "the upload failed" need different follow-up.
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
