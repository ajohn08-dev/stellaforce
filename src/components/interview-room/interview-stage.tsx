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
  turns,
  micMuted,
  cameraOn,
  stream,
  transport,
  onToggleMic,
  onToggleCamera,
  onEnd,
}: {
  agentName: string
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

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="relative min-h-0">
          <AgentTile
            agentName={agentName}
            isSpeaking={isSpeaking}
            connected={connected}
            getOutputFrequencyData={connected ? controls.getOutputByteFrequencyData : null}
          />

          {/* Picture-in-picture self view, as in any video call. */}
          <SelfTile
            stream={stream}
            cameraOn={cameraOn}
            micMuted={micMuted}
            connected={connected}
            getInputFrequencyData={connected ? controls.getInputByteFrequencyData : null}
            className="absolute right-4 bottom-4 aspect-video w-40 shadow-xl sm:w-52"
          />
        </div>

        <LiveTranscript
          turns={turns}
          connected={connected}
          agentName={agentName}
          className="max-lg:max-h-56"
        />
      </div>

      <RoomControls
        micMuted={micMuted}
        cameraOn={cameraOn}
        onToggleMic={onToggleMic}
        onToggleCamera={onToggleCamera}
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
