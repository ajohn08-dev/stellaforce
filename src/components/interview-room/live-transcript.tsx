"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export type TranscriptTurn = {
  id: number
  role: "user" | "agent"
  message: string
}

export function LiveTranscript({
  turns,
  connected,
  agentName,
  className,
}: {
  turns: TranscriptTurn[]
  connected: boolean
  agentName: string
  className?: string
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const pinnedRef = React.useRef(true)

  // Auto-scroll, but yield to the reader: once they scroll up to re-read an
  // earlier answer, new turns stop yanking them back to the bottom.
  const handleScroll = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  }, [])

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el || !pinnedRef.current) return
    el.scrollTop = el.scrollHeight
  }, [turns])

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col rounded-2xl border border-white/10 bg-brand-neutral-900",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-medium text-white">Live transcript</span>
        {connected && (
          <span className="flex items-center gap-1.5 text-xs text-white/50">
            <span className="size-1.5 animate-pulse rounded-full bg-brand-orange-500" />
            Recording
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
      >
        {turns.length === 0 ? (
          <p className="m-auto max-w-52 text-center text-sm text-white/40">
            {connected
              ? `${agentName} is about to speak. What's said will appear here as you go.`
              : "The transcript will appear here once the interview starts."}
          </p>
        ) : (
          turns.map((turn) => (
            <div key={turn.id} className="flex flex-col gap-1">
              <span
                className={cn(
                  "text-xs font-medium",
                  turn.role === "agent" ? "text-brand-orange-400" : "text-white/50"
                )}
              >
                {turn.role === "agent" ? agentName : "You"}
              </span>
              <p className="text-sm leading-relaxed text-white/85">{turn.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
