"use client"

import * as React from "react"
import { AlertCircle, Clock, Loader2, Mic, Sparkles, Video } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SelfTile } from "@/components/interview-room/room-tiles"
import type { useInterviewMedia } from "@/components/interview-room/use-interview-media"

type Media = ReturnType<typeof useInterviewMedia>

/** Native selects rather than the shadcn `Select`: this screen renders on a
 * dark surface outside the app shell, and the popover-based control inherits
 * light-theme tokens that would need overriding for no real gain here. */
function DeviceSelect({
  icon,
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  value: string | null
  options: { deviceId: string; label: string }[]
  onChange: (deviceId: string) => void
  disabled: boolean
}) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2.5 py-2 text-sm text-white/85 focus-within:border-brand-orange-500">
      <span className="shrink-0 text-white/55">{icon}</span>
      <span className="sr-only">{label}</span>
      <select
        value={value ?? ""}
        disabled={disabled || options.length === 0}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 cursor-pointer bg-transparent outline-none disabled:cursor-not-allowed [&>option]:bg-brand-neutral-900 [&>option]:text-white"
      >
        {options.length === 0 ? (
          <option value="">{label}</option>
        ) : (
          options.map((option) => (
            <option key={option.deviceId} value={option.deviceId}>
              {option.label}
            </option>
          ))
        )}
      </select>
    </label>
  )
}

export function InterviewBriefing({
  agentName,
  agentDescription,
  estimatedMinutes,
  media,
  onStart,
  preparing,
  startError,
}: {
  agentName: string
  agentDescription: string | null
  estimatedMinutes: number | null
  media: Media
  onStart: () => void
  /** The session token is still in flight. The button waits rather than
   * awaiting inside the click handler, which would cost the user gesture the
   * conversation needs — see `InterviewRoom`. */
  preparing: boolean
  startError: string | null
}) {
  const { status, error, request } = media

  // One automatic attempt on mount — the permission prompt is the first thing
  // that should happen, since everything else here depends on it. Re-requests
  // after a denial are explicit, via the retry button.
  const requestedRef = React.useRef(false)
  React.useEffect(() => {
    if (requestedRef.current) return
    requestedRef.current = true
    void request()
  }, [request])

  const ready = status === "ready"

  return (
    <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
      <div className="grid w-full max-w-4xl gap-6 rounded-2xl border border-white/10 bg-brand-neutral-900 p-6 md:grid-cols-2 md:p-8">
        <div className="flex flex-col gap-4">
          <div className="relative aspect-video w-full">
            <SelfTile
              stream={media.stream}
              cameraOn={media.cameraOn}
              micMuted={false}
              label="You"
              className="size-full"
            />

            {status === "requesting" && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60">
                <span className="flex items-center gap-2 text-sm text-white/80">
                  <Loader2 className="size-4 animate-spin" />
                  Waiting for camera access…
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <DeviceSelect
              icon={<Mic className="size-4" />}
              label="Microphone"
              value={media.microphoneId}
              options={media.microphones}
              onChange={media.selectMicrophone}
              disabled={!ready}
            />
            <DeviceSelect
              icon={<Video className="size-4" />}
              label="Camera"
              value={media.cameraId}
              options={media.cameras}
              onChange={media.selectCamera}
              disabled={!ready}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div className="flex flex-col items-start gap-2">
                <span>{error}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void request()}
                  className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  Try again
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-orange-600/15 px-2.5 py-1 text-xs font-medium text-brand-orange-300">
              <Sparkles className="size-3" />
              AI interviewer
            </span>
            <h1 className="text-xl font-semibold text-white">{agentName}</h1>
            {agentDescription && (
              <p className="text-sm leading-relaxed text-white/60">{agentDescription}</p>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <span className="text-sm font-medium text-white">What to expect</span>
            <ul className="flex flex-col gap-2.5 text-sm text-white/65">
              {estimatedMinutes !== null && (
                <li className="flex items-start gap-2">
                  <Clock className="mt-0.5 size-4 shrink-0 text-white/40" />
                  Around {estimatedMinutes} minute{estimatedMinutes === 1 ? "" : "s"}.
                </li>
              )}
              <li className="flex items-start gap-2">
                <Mic className="mt-0.5 size-4 shrink-0 text-white/40" />
                The interviewer speaks first. Answer out loud, in your own words — you can
                interrupt at any point.
              </li>
              <li className="flex items-start gap-2">
                <Video className="mt-0.5 size-4 shrink-0 text-white/40" />
                Your camera and voice are recorded, and the conversation is
                transcribed. The recording is shared with the hiring team
                reviewing your application.
              </li>
            </ul>
          </div>

          {startError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{startError}</span>
            </div>
          )}

          <div className="mt-auto flex flex-col gap-2">
            <Button
              size="lg"
              disabled={!ready || preparing || !!startError}
              onClick={onStart}
              className="w-full"
            >
              {ready && preparing ? (
                <>
                  <Loader2 className="animate-spin" />
                  Preparing…
                </>
              ) : (
                "Start Interview"
              )}
            </Button>
            <p className="text-center text-xs text-white/35">
              {!ready
                ? "Allow camera and microphone access to continue."
                : preparing
                  ? "Setting up your session."
                  : "By starting, you agree to this interview being recorded."}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
