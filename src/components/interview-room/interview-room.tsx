"use client"

import * as React from "react"
import Link from "next/link"
import { ConversationProvider, useConversationControls } from "@elevenlabs/react"
import { CheckCircle2, Loader2, MessageSquare, Video } from "lucide-react"

import { Button } from "@/components/ui/button"
import { InterviewBriefing } from "@/components/interview-room/interview-briefing"
import { InterviewStage } from "@/components/interview-room/interview-stage"
import { type TranscriptTurn } from "@/components/interview-room/live-transcript"
import { useInterviewMedia } from "@/components/interview-room/use-interview-media"
import { useInterviewRecorder } from "@/components/interview-room/use-interview-recorder"
import { createClient } from "@/lib/supabase/client"
import {
  createInterviewRoomSession,
  createInterviewVideoUpload,
  finalizeInterviewVideo,
  getInterviewRoomFailureReason,
  type InterviewRoomSession,
} from "@/app/interview-room/actions"

type Session = Extract<InterviewRoomSession, { ok: true }>

type Phase = "briefing" | "live" | "ended"

type RoomProps = {
  agentId: string
  agentName: string
  /** The interviewer's own name, e.g. "Priya" — what the agent calls itself in
   * conversation, as opposed to `agentName`, which names the interview. */
  agentDisplayName: string
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

type VideoUploadState = "idle" | "uploading" | "uploaded" | "failed"

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
  /** When the conversation opened, against the same clock as the recorder's
   * start — their difference is `video_offset_seconds`. */
  const connectedAtRef = React.useRef(0)

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
    // Stamp when the conversation actually opened. ElevenLabs starts its own
    // recording about here, whereas ours started on the click — the difference
    // is the offset the player needs to shift the video by. Measured rather
    // than eliminated: delaying the recorder until this callback meant that
    // whenever it didn't fire in time there was no recording at all.
    connectedAtRef.current = Date.now()
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
        conversationIdRef={conversationIdRef}
        connectedAtRef={connectedAtRef}
        onOpenedOn={handleOpenedOn}
      />
    </ConversationProvider>
  )
}

function RoomFlow({
  agentId,
  agentName,
  agentDisplayName,
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
  conversationIdRef,
  connectedAtRef,
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
  conversationIdRef: React.RefObject<string | null>
  connectedAtRef: React.RefObject<number>
  onOpenedOn: (transport: Transport) => void
}) {
  const controls = useConversationControls()
  const media = useInterviewMedia()
  const recorder = useInterviewRecorder()

  const [session, setSession] = React.useState<Session | null>(null)
  const [sessionError, setSessionError] = React.useState<string | null>(null)
  const [videoState, setVideoState] = React.useState<VideoUploadState>("idle")

  /**
   * Stops the recorder and ships the file. Deliberately *not* awaited by the
   * caller that ends the call: hanging up should feel instant, and the upload
   * continues underneath while the summary screen is already visible.
   */
  const uploadRecording = React.useCallback(async () => {
    const result = await recorder.stop()
    const conversationId = conversationIdRef.current
    if (!result || !conversationId) return

    setVideoState("uploading")
    try {
      const prepared = await createInterviewVideoUpload(conversationId, result.mimeType)
      if (!prepared.ok) throw new Error(prepared.error)

      // Straight to Storage with the signed token — the file never passes
      // through a Server Action, which could not carry tens of megabytes.
      const supabase = createClient()
      const { error } = await supabase.storage
        .from("video-recordings")
        .uploadToSignedUrl(prepared.path, prepared.token, result.blob, {
          contentType: result.mimeType,
        })
      if (error) throw new Error(error.message)

      await finalizeInterviewVideo({
        conversationId,
        path: prepared.path,
        sizeBytes: result.blob.size,
        mimeType: result.mimeType,
        durationSeconds: result.durationSeconds,
        // How far ahead of the conversation audio this video starts. Clamped:
        // a negative or absurd value means a clock we can't trust, and 0 (no
        // correction) is a better failure than a wrong shift.
        offsetSeconds:
          connectedAtRef.current > 0 && result.startedAt > 0
            ? Math.min(30, Math.max(0, (connectedAtRef.current - result.startedAt) / 1000))
            : 0,
        status: "uploaded",
      })
      setVideoState("uploaded")
    } catch (err) {
      console.error("[interview-room] video upload failed", err)
      // Record the failure against the row so the Conversations page can say
      // "the upload failed" rather than "no recording", which need different
      // follow-up.
      await finalizeInterviewVideo({
        conversationId,
        path: `failed/${conversationId}`,
        sizeBytes: 0,
        mimeType: result.mimeType,
        durationSeconds: result.durationSeconds,
        status: "failed",
      }).catch(() => {})
      setVideoState("failed")
    }
  }, [recorder, conversationIdRef, connectedAtRef])

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
      // After releaseMicrophone, so the stream is video-only and nothing
      // competes with the SDK for the mic.
      recorder.start(media.stream)

      if (session.token) {
        onOpenedOn("webrtc")
        controls.startSession({
          conversationToken: session.token,
          dynamicVariables: session.dynamicVariables,
          ...(session.overrides ? { overrides: session.overrides } : {}),
        })
      } else if (session.signedUrl) {
        // No WebRTC credential (rate-limited or refused) — open on the backup
        // transport rather than failing the interview.
        onOpenedOn("websocket")
        controls.startSession({
          signedUrl: session.signedUrl,
          connectionType: "websocket",
          dynamicVariables: session.dynamicVariables,
          ...(session.overrides ? { overrides: session.overrides } : {}),
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

  // One upload attempt per room, however the call ended — hang-up, agent
  // wrap-up, or a dropped connection all land on "ended".
  const uploadedRef = React.useRef(false)
  React.useEffect(() => {
    if (phase !== "ended" || uploadedRef.current) return
    uploadedRef.current = true
    void uploadRecording()
  }, [phase, uploadRecording])

  // Reconnect on the fallback transport. Runs outside a user gesture, which is
  // fine: the audio context was already unlocked by the original start.
  React.useEffect(() => {
    if (fallbackNonce === 0 || !session?.signedUrl) return
    startedAtRef.current = Date.now()
    controls.startSession({
      signedUrl: session.signedUrl,
      connectionType: "websocket",
      dynamicVariables: session.dynamicVariables,
      ...(session.overrides ? { overrides: session.overrides } : {}),
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
      <InterviewEnded
        agentName={agentName}
        turnCount={turns.length}
        error={endedError}
        videoState={videoState}
      />
    )
  }

  return (
    <InterviewStage
      agentName={agentName}
      agentDisplayName={agentDisplayName}
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
  videoState,
}: {
  agentName: string
  turnCount: number
  error: string | null
  videoState: VideoUploadState
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

        <div className="flex flex-col items-center gap-1.5 text-xs text-white/40">
          {turnCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="size-3.5" />
              {turnCount} turn{turnCount === 1 ? "" : "s"} captured
            </span>
          )}
          {videoState !== "idle" && (
            <span className="inline-flex items-center gap-1.5">
              {videoState === "uploading" ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving your video — keep this tab open
                </>
              ) : videoState === "uploaded" ? (
                <>
                  <Video className="size-3.5" />
                  Video saved
                </>
              ) : (
                <span className="text-red-300">Your video could not be saved</span>
              )}
            </span>
          )}
        </div>

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
