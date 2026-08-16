"use client"

import * as React from "react"

/**
 * Records the candidate's camera during an interview.
 *
 * **Video only, no audio.** By the time recording starts, the microphone has
 * been handed to the ElevenLabs SDK (see `use-interview-media.ts`), so the
 * stream carries a video track alone — which is the intent, not a limitation:
 * ElevenLabs already captures the conversation audio for *both* participants
 * and post-processes it, so a second local capture would be strictly worse and
 * would contend with the SDK's echo cancellation.
 *
 * The buffer lives in the page, so a closed tab loses the video. That is an
 * accepted trade for v1; the audio is unaffected either way, since ElevenLabs
 * holds it server-side.
 */

/** Ordered by playback compatibility, not encode quality. Safari can only play
 * H.264, and there is no transcoding anywhere in this stack — so if the
 * recording browser can produce MP4, take it, and a Safari-using recruiter can
 * watch it. Chrome/Firefox fall through to WebM. */
const MIME_CANDIDATES = [
  "video/mp4;codecs=h264",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
]

/** The video-recordings bucket caps objects at 500 MB. Stop a little under it:
 * a truncated-but-stored recording beats a complete one the bucket rejects. */
const MAX_BYTES = 480 * 1024 * 1024

/** ~1.2 Mbps keeps a talking head genuinely legible and still puts a 45-minute
 * interview around 400 MB — inside the cap with room to spare. The buffer is
 * held in the page until upload, so this is also a memory budget, not just a
 * storage one. */
const VIDEO_BITS_PER_SECOND = 1_200_000

export type RecorderState = "idle" | "recording" | "stopped" | "unsupported"

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null
}

export function useInterviewRecorder() {
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const bytesRef = React.useRef(0)
  const mimeRef = React.useRef<string | null>(null)
  const startedAtRef = React.useRef(0)
  const [state, setState] = React.useState<RecorderState>("idle")

  /**
   * Starts recording, from the "Start Interview" click.
   *
   * Deliberately *not* deferred to the SDK's `onConnect` to align with
   * ElevenLabs' own recording: when that callback didn't fire in time the
   * result was no recording at all. Starting here always works, and the
   * resulting head start is measured (`startedAt`) and corrected at playback.
   */
  const start = React.useCallback((stream: MediaStream | null) => {
    if (!stream || stream.getVideoTracks().length === 0) return

    const mimeType = pickMimeType()
    if (!mimeType) {
      // No MediaRecorder (or no usable codec) — the interview itself is
      // unaffected, so carry on without video rather than blocking the call.
      setState("unsupported")
      return
    }

    try {
      // A fresh MediaStream containing only the video track: the source stream
      // may still be mutated elsewhere (camera toggling), and we never want a
      // stray audio track to end up in the file.
      const videoOnly = new MediaStream(stream.getVideoTracks())
      const recorder = new MediaRecorder(videoOnly, {
        mimeType,
        videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
      })

      chunksRef.current = []
      bytesRef.current = 0
      mimeRef.current = mimeType

      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) return
        if (bytesRef.current + event.data.size > MAX_BYTES) {
          if (recorder.state === "recording") recorder.stop()
          return
        }
        chunksRef.current.push(event.data)
        bytesRef.current += event.data.size
      }

      // Timeslice, so chunks land periodically and the size guard above can act
      // mid-interview rather than discovering the overrun at the end.
      recorder.start(5000)
      recorderRef.current = recorder
      startedAtRef.current = Date.now()
      setState("recording")
    } catch {
      setState("unsupported")
    }
  }, [])

  /** Stops and resolves the finished file. Null if nothing was recorded. */
  const stop = React.useCallback((): Promise<{
    blob: Blob
    mimeType: string
    durationSeconds: number
    /** Wall clock at which recording began, for offset measurement. */
    startedAt: number
  } | null> => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === "inactive") {
      setState((s) => (s === "recording" ? "stopped" : s))
      return Promise.resolve(null)
    }

    return new Promise((resolve) => {
      recorder.onstop = () => {
        setState("stopped")
        const mimeType = mimeRef.current ?? "video/webm"
        const chunks = chunksRef.current
        chunksRef.current = []
        recorderRef.current = null

        if (chunks.length === 0) {
          resolve(null)
          return
        }
        resolve({
          blob: new Blob(chunks, { type: mimeType }),
          mimeType,
          startedAt: startedAtRef.current,
          durationSeconds: Math.max(
            1,
            Math.round((Date.now() - startedAtRef.current) / 1000)
          ),
        })
      }
      recorder.stop()
    })
  }, [])

  // Never leave an encoder running if the room unmounts for any reason.
  React.useEffect(() => {
    return () => {
      const recorder = recorderRef.current
      if (recorder && recorder.state !== "inactive") recorder.stop()
    }
  }, [])

  return { state, start, stop }
}
