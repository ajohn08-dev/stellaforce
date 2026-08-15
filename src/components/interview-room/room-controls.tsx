"use client"

import * as React from "react"
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function ControlButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      size="icon-lg"
      variant="ghost"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "size-11 rounded-full text-white hover:text-white",
        active ? "bg-white/10 hover:bg-white/20" : "bg-red-500/85 hover:bg-red-500"
      )}
    >
      {children}
    </Button>
  )
}

export function RoomControls({
  micMuted,
  cameraOn,
  onToggleMic,
  onToggleCamera,
  onEnd,
}: {
  micMuted: boolean
  cameraOn: boolean
  onToggleMic: () => void
  onToggleCamera: () => void
  onEnd: () => void
}) {
  // Ending is destructive and unrecoverable — the conversation can't be resumed
  // — so it takes a second press rather than an alert dialog, which would sit
  // badly over a live call.
  const [confirmingEnd, setConfirmingEnd] = React.useState(false)
  React.useEffect(() => {
    if (!confirmingEnd) return
    const timer = setTimeout(() => setConfirmingEnd(false), 4000)
    return () => clearTimeout(timer)
  }, [confirmingEnd])

  return (
    <div className="flex items-center justify-center gap-2">
      <ControlButton
        active={!micMuted}
        label={micMuted ? "Unmute microphone" : "Mute microphone"}
        onClick={onToggleMic}
      >
        {micMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
      </ControlButton>

      <ControlButton
        active={cameraOn}
        label={cameraOn ? "Turn camera off" : "Turn camera on"}
        onClick={onToggleCamera}
      >
        {cameraOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
      </ControlButton>

      <Button
        size="lg"
        aria-label="End interview"
        onClick={() => (confirmingEnd ? onEnd() : setConfirmingEnd(true))}
        className="ml-2 h-11 rounded-full bg-red-500 px-5 text-white hover:bg-red-600"
      >
        <PhoneOff className="size-5" />
        {confirmingEnd ? "Tap again to end" : "End interview"}
      </Button>
    </div>
  )
}
