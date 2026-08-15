"use client"

import * as React from "react"
import Link from "next/link"
import { ConversationProvider, useConversationControls } from "@elevenlabs/react"
import { CheckCircle2, MessageSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { InterviewBriefing } from "@/components/interview-room/interview-briefing"
import { InterviewStage } from "@/components/interview-room/interview-stage"
import { type TranscriptTurn } from "@/components/interview-room/live-transcript"
import { useInterviewMedia } from "@/components/interview-room/use-interview-media"
import {
  createInterviewRoomSession,
  getInterviewRoomFailureReason,
  type InterviewRoomSession,
} from "@/app/interview-room/actions"

type Session = Extract<InterviewRoomSession, { ok: true }>

type Phase = "briefing" | "live" | "ended"

type RoomProps = {
  agentId: string
  agentName: string
  agentDescription: string | null
  estimatedMinutes: number | null
}

/**
 * `ConversationProvider` wraps the **whole** flow, including the briefing, not
 * just the live stage. That's deliberate and load-bearing: `startSession` has to
 * be callable synchronously from the "Start Interview" click handler.
 *
 * Browsers only permit audio playback and microphone capture inside a call stack
 * that a user gesture initiated. An `await` between the click and
 * `startSession` — as in fetching the token first — ends that window, and the
 * session then fails to produce audio. So the token is fetched *during* the
 * briefing, and the click does nothing but spend it.
 */
export type Transport = "webrtc" | "websocket"

/** A WebRTC session that dies on its own this quickly is almost never a real
 * end of interview — it's the media path being eaten (VPN, firewall, low tunnel
 * MTU). Past this window, treat a drop as a genuine end and don't retry. */
const FALLBACK_WINDOW_MS = 30_000

export function InterviewRoom(props: RoomProps) {
  const [turns, setTurns] = React.useState<TranscriptTurn[]>([])
  const [micMuted, setMicMuted] = React.useState(false)
  const [endedError, setEndedError] = React.useState<string | null>(null)
  const [phase, setPhase] = React.useState<Phase>("briefing")
  const [transport, setTransport] = React.useState<Transport>("webrtc")
  /** Bumped to ask RoomFlow to re-open the session on the fallback transport. */
  const [fallbackNonce, setFallbackNonce] = React.useState(0)

  // Refs, not state: these are read inside SDK callbacks, which capture the
  // closure at registration time and would otherwise see stale values.
  const phaseRef = React.useRef<Phase>("briefing")
  const transportRef = React.useRef<Transport>("webrtc")
  const startedAtRef = React.useRef(0)
  const endedByUserRef = React.useRef(false)
  const triedFallbackRef = React.useRef(false)
  const canFallbackRef = React.useRef(false)
  const conversationIdRef = React.useRef<string | null>(null)
  const heardAgentRef = React.useRef(false)

  /** Replaces the SDK's opaque error text with ElevenLabs' own reason, once we
   * can fetch it. Fire-and-forget: the ended screen is already on screen. */
  const explainFailure = React.useCallback((fallbackMessage: string | null) => {
    setEndedError(fallbackMessage)
    const id = conversationIdRef.current
    if (!id) return
    getInterviewRoomFailureReason(id).then((reason) => {
      if (reason) setEndedError(reason)
    })
  }, [])

  const setPhaseTracked = React.useCallback((next: Phase) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  /** Records which transport a session actually opened on — so the badge is
   * honest when we start straight on WebSocket, not only after a fallback. */
  const handleOpenedOn = React.useCallback((next: Transport) => {
    transportRef.current = next
    setTransport(next)
  }, [])

  const handleMessage = React.useCallback(
    ({ message, role }: { message: string; role: string }) => {
      if (!message?.trim()) return
      if (role !== "user") heardAgentRef.current = true
      setTurns((prev) => [
        ...prev,
        { id: prev.length, role: role === "user" ? "user" : "agent", message },
      ])
    },
    []
  )

  const handleConnect = React.useCallback(({ conversationId }: { conversationId: string }) => {
    conversationIdRef.current = conversationId
  }, [])

  /** Returns true if it consumed the failure by scheduling a retry. */
  const tryFallback = React.useCallback(() => {
    if (triedFallbackRef.current) return false
    if (endedByUserRef.current) return false
    if (transportRef.current !== "webrtc") return false
    if (!canFallbackRef.current) return false
    if (Date.now() - startedAtRef.current > FALLBACK_WINDOW_MS) return false
    // If a full agent turn already came through, the media path demonstrably
    // works, so the failure is server-side (quota, agent config, outage) and
    // reconnecting would only burn a second conversation to fail identically.
    if (heardAgentRef.current) return false

    triedFallbackRef.current = true
    transportRef.current = "websocket"
    setTransport("websocket")
    setTurns([])
    setFallbackNonce((n) => n + 1)
    return true
  }, [])

  // Fires when the candidate hangs up and when ElevenLabs drops the call, so
  // the summary is reached by either route.
  const handleDisconnect = React.useCallback(() => {
    if (phaseRef.current !== "live") return
    if (tryFallback()) return
    setPhaseTracked("ended")
    // A clean hang-up has nothing to explain; anything else might.
    if (!endedByUserRef.current) explainFailure(null)
  }, [tryFallback, setPhaseTracked, explainFailure])

  const handleError = React.useCallback(
    (message: string) => {
      if (tryFallback()) return
      setPhaseTracked("ended")
      explainFailure(message)
    },
    [tryFallback, setPhaseTracked, explainFailure]
  )

  return (
    <ConversationProvider
      isMuted={micMuted}
      onMutedChange={setMicMuted}
      onConnect={handleConnect}
      onMessage={handleMessage}
      onDisconnect={handleDisconnect}
      onError={handleError}
    >
      <RoomFlow
        {...props}
        phase={phase}
        setPhase={setPhaseTracked}
        turns={turns}
        micMuted={micMuted}
        setMicMuted={setMicMuted}
        endedError={endedError}
        transport={transport}
        fallbackNonce={fallbackNonce}
        startedAtRef={startedAtRef}
        endedByUserRef={endedByUserRef}
        canFallbackRef={canFallbackRef}
        onOpenedOn={handleOpenedOn}
      />
    </ConversationProvider>
  )
}

function RoomFlow({
  agentId,
  agentName,
  agentDescription,
  estimatedMinutes,
  phase,
  setPhase,
  turns,
  micMuted,
  setMicMuted,
  endedError,
  transport,
  fallbackNonce,
  startedAtRef,
  endedByUserRef,
  canFallbackRef,
  onOpenedOn,
}: RoomProps & {
  phase: Phase
  setPhase: (phase: Phase) => void
  turns: TranscriptTurn[]
  micMuted: boolean
  setMicMuted: React.Dispatch<React.SetStateAction<boolean>>
  endedError: string | null
  transport: Transport
  fallbackNonce: number
  startedAtRef: React.RefObject<number>
  endedByUserRef: React.RefObject<boolean>
  canFallbackRef: React.RefObject<boolean>
  onOpenedOn: (transport: Transport) => void
}) {
  const controls = useConversationControls()
  const media = useInterviewMedia()

  const [session, setSession] = React.useState<Session | null>(null)
  const [sessionError, setSessionError] = React.useState<string | null>(null)

  // Credentials are fetched up front, the moment the devices are live — see the
  // gesture note on InterviewRoom. It also means the click is instant rather
  // than stalling for the round trip.
  const requestedRef = React.useRef(false)
  React.useEffect(() => {
    if (requestedRef.current || media.status !== "ready") return
    requestedRef.current = true

    createInterviewRoomSession(agentId).then((result) => {
      if (result.ok) {
        setSession(result)
        // Only meaningful when we're actually starting on WebRTC; opening
        // straight onto WebSocket has nothing left to fall back to.
        canFallbackRef.current = result.signedUrl !== null && result.token !== null
      } else {
        setSessionError(result.error)
      }
    })
  }, [agentId, media.status, canFallbackRef])

  function handleStart() {
    if (!session) {
      setSessionError("No interview session is ready yet. Reload the page and try again.")
      return
    }

    // Nothing awaited here — the gesture has to survive to startSession.
    // Wrapped because a synchronous throw (blocked mic, unusable credential)
    // never reaches the SDK's onError, and would otherwise strand the room on
    // "Connecting…" with nothing written to any log.
    try {
      media.releaseMicrophone()
      startedAtRef.current = Date.now()

      if (session.token) {
        onOpenedOn("webrtc")
        controls.startSession({
          conversationToken: session.token,
          dynamicVariables: session.dynamicVariables,
        })
      } else if (session.signedUrl) {
        // No WebRTC credential (rate-limited or refused) — open on the backup
        // transport rather than failing the interview.
        onOpenedOn("websocket")
        controls.startSession({
          signedUrl: session.signedUrl,
          connectionType: "websocket",
          dynamicVariables: session.dynamicVariables,
        })
      } else {
        setSessionError("ElevenLabs returned no usable connection for this agent.")
        return
      }
    } catch (err) {
      console.error("[interview-room] startSession threw", err)
      setSessionError(
        err instanceof Error ? `Could not start the interview: ${err.message}` : "Could not start the interview."
      )
      return
    }

    setPhase("live")
  }

  // Reconnect on the fallback transport. Runs outside a user gesture, which is
  // fine: the audio context was already unlocked by the original start.
  React.useEffect(() => {
    if (fallbackNonce === 0 || !session?.signedUrl) return
    startedAtRef.current = Date.now()
    controls.startSession({
      signedUrl: session.signedUrl,
      connectionType: "websocket",
      dynamicVariables: session.dynamicVariables,
    })
  }, [fallbackNonce, session, controls, startedAtRef])

  if (phase === "briefing") {
    return (
      <InterviewBriefing
        agentName={agentName}
        agentDescription={agentDescription}
        estimatedMinutes={estimatedMinutes}
        media={media}
        onStart={handleStart}
        preparing={!session && !sessionError}
        startError={sessionError}
      />
    )
  }

  if (phase === "ended") {
    return (
      <InterviewEnded agentName={agentName} turnCount={turns.length} error={endedError} />
    )
  }

  return (
    <InterviewStage
      agentName={agentName}
      turns={turns}
      micMuted={micMuted}
      cameraOn={media.cameraOn}
      stream={media.stream}
      transport={transport}
      onToggleMic={() => setMicMuted((m) => !m)}
      onToggleCamera={media.toggleCamera}
      onEnd={() => {
        // Marks this as a deliberate hang-up so the drop isn't mistaken for
        // transport failure and retried on WebSocket.
        endedByUserRef.current = true
        setPhase("ended")
      }}
    />
  )
}

function InterviewEnded({
  agentName,
  turnCount,
  error,
}: {
  agentName: string
  turnCount: number
  error: string | null
}) {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-white/10 bg-brand-neutral-900 p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-brand-orange-600/15">
          <CheckCircle2 className="size-6 text-brand-orange-400" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-lg font-semibold text-white">Interview ended</h1>
          <p className="text-sm leading-relaxed text-white/60">
            {error
              ? error
              : `Your conversation with ${agentName} is complete. The recording and transcript are being processed and will appear under Conversations shortly.`}
          </p>
        </div>

        {turnCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs text-white/40">
            <MessageSquare className="size-3.5" />
            {turnCount} turn{turnCount === 1 ? "" : "s"} captured
          </span>
        )}

        <Button
          nativeButton={false}
          render={<Link href="/agents/home" />}
          variant="outline"
          className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
        >
          Back to agents
        </Button>
      </div>
    </div>
  )
}
