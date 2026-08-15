"use client"

import * as React from "react"
import { Maximize2, MicOff, Minimize2, VideoOff } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Per-tile expand/collapse affordance. Expanding a tile makes it the stage and
 * demotes the other to a corner; collapsing returns both to the even split.
 */
function FocusButton({
  focused,
  label,
  onClick,
}: {
  focused: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="absolute top-2 right-2 z-20 flex size-7 items-center justify-center rounded-md bg-black/50 text-white/70 backdrop-blur-sm transition-colors outline-none hover:bg-black/70 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
    >
      {focused ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
    </button>
  )
}

/**
 * Samples a byte-frequency getter on an animation frame and hands a smoothed
 * 0–1 level to `apply`.
 *
 * `apply` writes to the DOM directly rather than to React state: this runs at
 * frame rate, and re-rendering 60×/second to move a ring would be wasteful (and
 * trips the react-hooks compiler rule against cascading effect renders).
 *
 * Both tiles read from the ElevenLabs SDK's analysers rather than building their
 * own — the agent has no MediaStream to attach one to (its audio is synthesised
 * and played by the SDK), and the user's mic belongs to the SDK once the
 * interview starts; see `use-interview-media.ts`.
 */
function useAudioLevel(
  getFrequencyData: (() => Uint8Array) | null,
  active: boolean,
  apply: (level: number) => void
) {
  const applyRef = React.useRef(apply)
  React.useEffect(() => {
    applyRef.current = apply
  })

  React.useEffect(() => {
    if (!getFrequencyData || !active) {
      applyRef.current(0)
      return
    }

    let frame = 0
    let smoothed = 0

    const tick = () => {
      frame = requestAnimationFrame(tick)

      let data: Uint8Array
      try {
        data = getFrequencyData()
      } catch {
        // The analyser only exists while a session is connected; a teardown
        // race here should stop the ring, not break the room.
        return
      }
      if (!data?.length) return

      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i]
      const next = sum / data.length / 255

      // Asymmetric smoothing — snap up so speech onset reads instantly, ease
      // down so the ring doesn't strobe between syllables.
      smoothed = next > smoothed ? next : smoothed * 0.85 + next * 0.15
      applyRef.current(smoothed)
    }

    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      applyRef.current(0)
    }
  }, [getFrequencyData, active])
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function AgentTile({
  agentName,
  isSpeaking,
  connected,
  getOutputFrequencyData,
  /** Picture-in-picture rendering: shrinks the avatar and rings, and moves the
   * name into a corner chip so it stays legible at tile size. */
  compact = false,
  className,
  focused = false,
  onToggleFocus,
}: {
  agentName: string
  isSpeaking: boolean
  connected: boolean
  getOutputFrequencyData: (() => Uint8Array) | null
  compact?: boolean
  className?: string
  focused?: boolean
  onToggleFocus?: () => void
}) {
  const outerRingRef = React.useRef<HTMLDivElement>(null)
  const innerRingRef = React.useRef<HTMLDivElement>(null)

  const applyLevel = React.useCallback(
    (level: number) => {
      const outer = outerRingRef.current
      const inner = innerRingRef.current
      if (outer) {
        // Transform + opacity only — never triggers layout.
        outer.style.transform = `scale(${1 + level * 0.55})`
        outer.style.opacity = connected ? String(0.35 + level * 0.65) : "0"
      }
      if (inner) {
        inner.style.transform = `scale(${1 + level * 0.28})`
        inner.style.opacity = connected ? "0.5" : "0"
      }
    },
    [connected]
  )

  useAudioLevel(getOutputFrequencyData, connected, applyLevel)

  const status = !connected ? "Connecting…" : isSpeaking ? "Speaking…" : "Listening"

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden border border-white/10 bg-brand-neutral-900",
        compact ? "rounded-xl" : "size-full rounded-2xl",
        className
      )}
    >
      {onToggleFocus && (
        <FocusButton
          focused={focused}
          label={focused ? "Shrink interviewer" : "Expand interviewer"}
          onClick={onToggleFocus}
        />
      )}

      <div className={cn("relative flex flex-col items-center", compact ? "gap-0" : "gap-5")}>
        <div className="relative flex items-center justify-center">
          <div
            ref={outerRingRef}
            aria-hidden
            className={cn(
              "absolute rounded-full bg-brand-orange-600/25 opacity-0",
              compact ? "size-20" : "size-44"
            )}
          />
          <div
            ref={innerRingRef}
            aria-hidden
            className={cn(
              "absolute rounded-full bg-brand-orange-600/20 opacity-0",
              compact ? "size-20" : "size-44"
            )}
          />
          <div
            className={cn(
              "relative flex items-center justify-center rounded-full bg-gradient-to-br from-brand-orange-500 to-brand-orange-700 font-semibold text-white shadow-lg",
              compact ? "size-12 text-sm" : "size-28 text-2xl"
            )}
          >
            {initialsOf(agentName) || "SF"}
          </div>
        </div>

        {!compact && (
          <div className="flex flex-col items-center gap-1.5 text-center">
            <span className="text-sm font-medium text-white">{agentName}</span>
            <span className="text-xs text-white/55">{status}</span>
          </div>
        )}
      </div>

      {compact && (
        <div className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-xs text-white backdrop-blur-sm">
          <span
            aria-hidden
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              isSpeaking && connected ? "bg-brand-orange-400" : "bg-white/40"
            )}
          />
          <span className="truncate">{agentName}</span>
          <span className="sr-only">{status}</span>
        </div>
      )}
    </div>
  )
}

export function SelfTile({
  stream,
  cameraOn,
  micMuted,
  label = "You",
  getInputFrequencyData,
  connected,
  className,
  focused = false,
  onToggleFocus,
}: {
  stream: MediaStream | null
  cameraOn: boolean
  micMuted: boolean
  label?: string
  getInputFrequencyData?: (() => Uint8Array) | null
  connected?: boolean
  className?: string
  focused?: boolean
  onToggleFocus?: () => void
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const outlineRef = React.useRef<HTMLDivElement>(null)

  const applyLevel = React.useCallback(
    (level: number) => {
      const el = outlineRef.current
      if (el) el.style.opacity = micMuted ? "0" : String(Math.min(1, level * 2.5))
    },
    [micMuted]
  )

  useAudioLevel(getInputFrequencyData ?? null, !!connected && !micMuted, applyLevel)

  React.useEffect(() => {
    const el = videoRef.current
    if (!el || el.srcObject === stream) return
    el.srcObject = stream
  }, [stream])

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/15 bg-brand-neutral-900",
        className
      )}
    >
      {onToggleFocus && (
        <FocusButton
          focused={focused}
          label={focused ? "Shrink your video" : "Expand your video"}
          onClick={onToggleFocus}
        />
      )}

      {/* Speaking outline, driven by input level rather than a boolean, so it
          reads as a live meter instead of a blinking indicator. */}
      <div
        ref={outlineRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-xl border-2 border-brand-orange-500 opacity-0 transition-opacity duration-100"
      />

      <video
        ref={videoRef}
        autoPlay
        playsInline
        // Muted is required for autoplay, and we never want to hear ourselves.
        muted
        className={cn(
          "size-full object-cover",
          // Mirrored: people expect their self-view to behave like a mirror.
          "-scale-x-100",
          !cameraOn && "invisible"
        )}
      />

      {!cameraOn && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-white/50">
            <VideoOff className="size-6" />
            <span className="text-xs">Camera off</span>
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-xs text-white backdrop-blur-sm">
        {micMuted && <MicOff className="size-3 text-red-400" />}
        {label}
      </div>
    </div>
  )
}
