"use client"

import * as React from "react"
import { Pause, Play, Volume2, VolumeX } from "lucide-react"

/**
 * One player for an interview that was recorded as two files: the candidate's
 * camera (silent, captured in the browser) and the ElevenLabs conversation
 * audio (both participants).
 *
 * The audio element is the engine and is never shown — it is the authoritative
 * record, it always exists, and it survives a candidate who turned their camera
 * off mid-answer. The video is the picture and follows it. The control bar
 * below drives the audio, so there is exactly one timeline on screen.
 */

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, "0")}`
}

/**
 * MediaRecorder writes for a live stream, not for playback, so the container
 * carries no real duration — a fragmented MP4 arrives with `mvhd duration = 0`
 * (verified against an actual recording), and WebM arrives with no Duration
 * element at all. Either way the browser reports 0 or Infinity, the file is
 * **not seekable**, and every attempt to sync it is a silent no-op.
 *
 * Seeking far past the end forces the browser to scan the fragments and
 * establish the real duration, after which normal seeking works. Ugly, and the
 * standard fix — the alternative is rewriting container headers before upload.
 *
 * Note the guard tests for a *positive* finite duration: `0` is finite, and
 * that's precisely the broken case.
 */
function primeSeekable(video: HTMLVideoElement) {
  if (Number.isFinite(video.duration) && video.duration > 0) return
  const onTimeUpdate = () => {
    video.removeEventListener("timeupdate", onTimeUpdate)
    video.currentTime = 0
  }
  video.addEventListener("timeupdate", onTimeUpdate)
  video.currentTime = 1e101
}

export function SyncedInterviewPlayer({
  videoUrl,
  videoMimeType,
  audioUrl,
  audioMimeType,
}: {
  videoUrl: string
  videoMimeType: string | null
  audioUrl: string
  audioMimeType: string | null
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const audioRef = React.useRef<HTMLAudioElement>(null)

  const [playing, setPlaying] = React.useState(false)
  const [muted, setMuted] = React.useState(false)
  const [current, setCurrent] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  // True while the user drags the scrubber — the playhead must follow the
  // thumb, not the audio, or the two fight each other every timeupdate.
  const scrubbingRef = React.useRef(false)

  React.useEffect(() => {
    const video = videoRef.current
    const audio = audioRef.current
    if (!video || !audio) return

    const onVideoMeta = () => primeSeekable(video)
    const onAudioMeta = () => setDuration(audio.duration)
    const onPlay = () => {
      setPlaying(true)
      void video.play().catch(() => {})
    }
    const onPause = () => {
      setPlaying(false)
      video.pause()
    }
    const onEnded = () => {
      setPlaying(false)
      video.pause()
    }
    const onSeeked = () => {
      // A user scrub is the one case worth a hard seek regardless of cost.
      if (video.seekable.length > 0) video.currentTime = audio.currentTime
      video.playbackRate = 1
    }
    const onTimeUpdate = () => {
      if (!scrubbingRef.current) setCurrent(audio.currentTime)
      if (audio.paused || video.readyState < 2) return

      // The two files start a beat apart — recording begins on the click, the
      // conversation once ElevenLabs connects — and encoders drift over a long
      // interview.
      const drift = video.currentTime - audio.currentTime
      const size = Math.abs(drift)

      if (size > 1.5 && video.seekable.length > 0) {
        // Far out of step: only a seek closes a gap this size. Expensive on a
        // fragmented MP4 with no index, which is why the threshold is generous.
        video.currentTime = audio.currentTime
        video.playbackRate = 1
      } else if (size > 0.2) {
        // Close: ease back by running the picture slightly fast or slow. Much
        // smoother than a seek, and it doesn't depend on the file being
        // seekable at all — which matters, because MediaRecorder output often
        // isn't until the priming above has run.
        video.playbackRate = drift > 0 ? 0.95 : 1.05
      } else if (video.playbackRate !== 1) {
        video.playbackRate = 1
      }
    }

    video.addEventListener("loadedmetadata", onVideoMeta)
    audio.addEventListener("loadedmetadata", onAudioMeta)
    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)
    audio.addEventListener("ended", onEnded)
    audio.addEventListener("seeked", onSeeked)
    audio.addEventListener("timeupdate", onTimeUpdate)

    // Metadata may already be in by the time this effect runs.
    if (video.readyState >= 1) onVideoMeta()
    if (audio.readyState >= 1) onAudioMeta()

    return () => {
      video.removeEventListener("loadedmetadata", onVideoMeta)
      audio.removeEventListener("loadedmetadata", onAudioMeta)
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
      audio.removeEventListener("ended", onEnded)
      audio.removeEventListener("seeked", onSeeked)
      audio.removeEventListener("timeupdate", onTimeUpdate)
    }
  }, [])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play().catch(() => {})
    else audio.pause()
  }

  function toggleMute() {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = !audio.muted
    setMuted(audio.muted)
  }

  function seekTo(value: number) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = value
    setCurrent(value)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-black">
      <video
        ref={videoRef}
        muted
        playsInline
        preload="metadata"
        onClick={togglePlay}
        className="aspect-video w-full cursor-pointer object-contain"
      >
        <source src={videoUrl} type={videoMimeType ?? undefined} />
        Your browser doesn&rsquo;t support video playback.
      </video>

      {/* The transport, attached to the picture — one player, one timeline. */}
      <div className="flex items-center gap-3 bg-brand-neutral-900 px-3 py-2">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-white transition-colors outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {playing ? (
            <Pause className="size-4 fill-current" />
          ) : (
            <Play className="size-4 fill-current" />
          )}
        </button>

        <span className="shrink-0 font-mono text-xs tabular-nums text-white/70">
          {formatTime(current)} / {formatTime(duration)}
        </span>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          aria-label="Seek"
          onPointerDown={() => (scrubbingRef.current = true)}
          onPointerUp={() => (scrubbingRef.current = false)}
          onChange={(e) => seekTo(Number(e.target.value))}
          className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/25 accent-brand-orange-500 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        />

        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-white transition-colors outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </div>

      {/* The engine. Hidden on purpose: the bar above is the only transport. */}
      <audio ref={audioRef} preload="metadata" className="hidden">
        <source src={audioUrl} type={audioMimeType ?? undefined} />
      </audio>
    </div>
  )
}
