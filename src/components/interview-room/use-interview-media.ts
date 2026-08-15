"use client"

import * as React from "react"

export type MediaPermissionStatus = "idle" | "requesting" | "ready" | "denied" | "error"

export type MediaDeviceOption = { deviceId: string; label: string }

/**
 * Owns the local camera/mic stream for the interview room.
 *
 * Deliberate split of ownership: this hook holds the **camera** for the whole
 * session, but only holds the **microphone** during the briefing, for the
 * device check. `releaseMicrophone()` is called at the moment the interview
 * starts so the ElevenLabs SDK is the sole owner of the mic — two concurrent
 * captures of the same input device fight over echo cancellation and gain
 * control, and the SDK's own `getInputByteFrequencyData()` covers the in-room
 * level meter anyway.
 *
 * The video track is never sent anywhere. It is a local preview so the room
 * feels like a video call; the conversation itself is audio-only.
 */
export function useInterviewMedia() {
  const [stream, setStream] = React.useState<MediaStream | null>(null)
  const [status, setStatus] = React.useState<MediaPermissionStatus>("idle")
  const [error, setError] = React.useState<string | null>(null)
  const [cameras, setCameras] = React.useState<MediaDeviceOption[]>([])
  const [microphones, setMicrophones] = React.useState<MediaDeviceOption[]>([])
  const [cameraId, setCameraId] = React.useState<string | null>(null)
  const [microphoneId, setMicrophoneId] = React.useState<string | null>(null)
  const [cameraOn, setCameraOn] = React.useState(true)

  // Mirrors `stream` for the unmount cleanup, which must not re-run (and tear
  // the stream down mid-interview) every time the stream reference changes.
  const streamRef = React.useRef<MediaStream | null>(null)
  React.useEffect(() => {
    streamRef.current = stream
  }, [stream])

  React.useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  /** Device labels are empty strings until a permission grant exists, so this
   * is only ever called after a successful getUserMedia. */
  const refreshDevices = React.useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    const devices = await navigator.mediaDevices.enumerateDevices()
    const toOption = (d: MediaDeviceInfo, fallback: string, index: number) => ({
      deviceId: d.deviceId,
      label: d.label || `${fallback} ${index + 1}`,
    })
    setCameras(
      devices
        .filter((d) => d.kind === "videoinput")
        .map((d, i) => toOption(d, "Camera", i))
    )
    setMicrophones(
      devices
        .filter((d) => d.kind === "audioinput")
        .map((d, i) => toOption(d, "Microphone", i))
    )
  }, [])

  const request = React.useCallback(
    async (opts?: { cameraId?: string | null; microphoneId?: string | null }) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error")
        setError("This browser doesn't support camera and microphone access.")
        return
      }

      setStatus("requesting")
      setError(null)

      const nextCameraId = opts?.cameraId ?? cameraId
      const nextMicrophoneId = opts?.microphoneId ?? microphoneId

      try {
        const next = await navigator.mediaDevices.getUserMedia({
          video: nextCameraId ? { deviceId: { exact: nextCameraId } } : true,
          audio: nextMicrophoneId ? { deviceId: { exact: nextMicrophoneId } } : true,
        })

        // Swap, don't accumulate — switching devices would otherwise leave the
        // previous camera's indicator light on.
        streamRef.current?.getTracks().forEach((track) => track.stop())
        setStream(next)
        setStatus("ready")
        setCameraOn(true)

        const video = next.getVideoTracks()[0]
        const audio = next.getAudioTracks()[0]
        if (video) setCameraId(video.getSettings().deviceId ?? nextCameraId ?? null)
        if (audio) setMicrophoneId(audio.getSettings().deviceId ?? nextMicrophoneId ?? null)

        await refreshDevices()
      } catch (err) {
        const name = err instanceof DOMException ? err.name : ""
        if (name === "NotAllowedError" || name === "SecurityError") {
          setStatus("denied")
          setError(
            "Camera and microphone access was blocked. Allow both in your browser's address bar, then try again."
          )
          return
        }
        setStatus("error")
        setError(
          name === "NotFoundError"
            ? "No camera or microphone was found on this device."
            : err instanceof Error
              ? err.message
              : "Could not start your camera and microphone."
        )
      }
    },
    [cameraId, microphoneId, refreshDevices]
  )

  /** Hands the microphone over to the ElevenLabs SDK — see the hook docblock. */
  const releaseMicrophone = React.useCallback(() => {
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.stop()
      streamRef.current?.removeTrack(track)
    })
  }, [])

  const toggleCamera = React.useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setCameraOn(track.enabled)
  }, [])

  return {
    stream,
    status,
    error,
    cameras,
    microphones,
    cameraId,
    microphoneId,
    cameraOn,
    request,
    releaseMicrophone,
    toggleCamera,
    selectCamera: (id: string) => request({ cameraId: id }),
    selectMicrophone: (id: string) => request({ microphoneId: id }),
  }
}
