"use client"

import * as React from "react"
import {
  useConversationControls,
  useConversationMode,
  useConversationStatus,
} from "@elevenlabs/react"

import { AgentTile, SelfTile } from "@/components/interview-room/room-tiles"
import { LiveTranscript, type TranscriptTurn } from "@/components/interview-room/live-transcript"
import { RoomControls } from "@/components/interview-room/room-controls"
import { cn } from "@/lib/utils"

function formatElapsed(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, "0")}`
}

/**
 * The live room. Must render inside `<ConversationProvider>` — every hook here
 * reads from it.
 *
 * The session is *not* started here. `startSession` is called synchronously
 * from the briefing's click handler so the browser's user-gesture window
 * survives to reach it; see the docblock on `InterviewRoom`. By the time this
 * mounts, the conversation is already connecting.
 */
export function InterviewStage({
  agentName,
  agentDisplayName,
  turns,
  micMuted,
  cameraOn,
  stream,
  transport,
  onToggleMic,
  onToggleCamera,
  onEnd,
}: {
  /** Names the interview — shown in the header. */
  agentName: string
  /** Names the interviewer — shown on the tile and against each turn, because
   * that's who is actually speaking. */
  agentDisplayName: string
  turns: TranscriptTurn[]
  micMuted: boolean
  cameraOn: boolean
  stream: MediaStream | null
  transport: "webrtc" | "websocket"
  onToggleMic: () => void
  onToggleCamera: () => void
  onEnd: () => void
}) {
  const controls = useConversationControls()
  const { status } = useConversationStatus()
  const { isSpeaking } = useConversationMode()

  const connected = status === "connected"

  // Off by default — the transcript is a reference aid, and a candidate reading
  // along tends to stop looking at the camera.
  const [transcriptOpen, setTranscriptOpen] = React.useState(false)

  // "split" gives both participants equal weight, which is the honest default:
  // neither the candidate nor the interviewer is the subordinate one.
  const [focus, setFocus] = React.useState<"split" | "self" | "agent">("split")

  const [elapsed, setElapsed] = React.useState(0)
  React.useEffect(() => {
    if (!connected) return
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [connected])

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="truncate text-sm font-medium text-white">{agentName}</span>
          <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
            Test interview
          </span>
          {transport === "websocket" && (
            <span
              className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300"
              title="WebRTC was blocked on this network, so the call reconnected over a backup WebSocket connection."
            >
              Backup connection
            </span>
          )}
        </div>
        <span className="shrink-0 font-mono text-sm tabular-nums text-white/60">
          {connected ? formatElapsed(elapsed) : "Connecting…"}
        </span>
      </div>

      <div
        className={cn(
          "grid min-h-0 flex-1 gap-4",
          transcriptOpen && "lg:grid-cols-[1fr_20rem]"
        )}
      >
        {/* Three layouts from one piece of state. Split shows both participants
            at equal size; focusing either one promotes it to the stage and
            demotes the other to a corner tile. Each tile carries its own
            expand/collapse control, so it's the viewer's choice. */}
        <div
          className={cn(
            "relative min-h-0",
            focus === "split" && "grid gap-4 max-md:grid-rows-2 md:grid-cols-2"
          )}
        >
          <SelfTile
            stream={stream}
            cameraOn={cameraOn}
            micMuted={micMuted}
            connected={connected}
            getInputFrequencyData={connected ? controls.getInputByteFrequencyData : null}
            focused={focus === "self"}
            onToggleFocus={() => setFocus((f) => (f === "self" ? "split" : "self"))}
            className={cn(
              focus === "agent"
                ? "absolute right-4 bottom-4 z-10 aspect-video w-40 shadow-xl sm:w-52"
                : "size-full rounded-2xl"
            )}
          />

          <AgentTile
            agentName={agentDisplayName}
            isSpeaking={isSpeaking}
            connected={connected}
            getOutputFrequencyData={connected ? controls.getOutputByteFrequencyData : null}
            compact={focus === "self"}
            focused={focus === "agent"}
            onToggleFocus={() => setFocus((f) => (f === "agent" ? "split" : "agent"))}
            className={cn(
              focus === "self" &&
                "absolute right-4 bottom-4 z-10 aspect-video w-40 shadow-xl sm:w-52"
            )}
          />
        </div>

        {transcriptOpen && (
          <LiveTranscript
            turns={turns}
            connected={connected}
            agentName={agentDisplayName}
            className="max-lg:max-h-56"
          />
        )}
      </div>

      <RoomControls
        micMuted={micMuted}
        cameraOn={cameraOn}
        transcriptOpen={transcriptOpen}
        onToggleMic={onToggleMic}
        onToggleCamera={onToggleCamera}
        onToggleTranscript={() => setTranscriptOpen((open) => !open)}
        onEnd={() => {
          // Close the conversation *then* advance the phase. `onDisconnect`
          // would get us there too, but not if the socket is already gone —
          // this way ending the call is never a dead button.
          controls.endSession()
          onEnd()
        }}
      />
    </div>
  )
}
