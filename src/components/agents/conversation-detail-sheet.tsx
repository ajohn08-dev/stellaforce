"use client"

import * as React from "react"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ConversationMediaPreview } from "@/components/agents/conversation-media-preview"
import { formatDate } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { Conversation } from "@/lib/conversations"

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * Read-only transcript viewer for a single conversation — mirrors
 * candidate-profile-sheet.tsx's Sheet setup (right side, scoped to
 * #app-content so the sidebar stays visible), but driven by the parent
 * table's local selection state rather than a URL/route, since there's no
 * persisted conversation record to deep-link to yet.
 */
export function ConversationDetailSheet({
  conversation,
  onOpenChange,
}: {
  conversation: Conversation | null
  onOpenChange: (open: boolean) => void
}) {
  // Unlike candidate-profile-sheet.tsx (only ever mounted client-side via an
  // intercepted route), this Sheet renders inline in a normal page, so it
  // goes through SSR where `document` doesn't exist — guard instead of
  // stashing in state; getElementById is cheap/referentially stable, and the
  // Sheet starts closed so this can't affect hydration output.
  const container =
    typeof document !== "undefined" ? (document.getElementById("app-content") ?? undefined) : undefined

  // Built by filtering rather than conditional JSX so a missing date/number
  // never leaves an orphaned "·" separator behind.
  const metadata = conversation
    ? [
        conversation.started_on ? formatDate(conversation.started_on) : null,
        conversation.started_at ? formatTime(conversation.started_at) : null,
        conversation.to_number,
      ].filter((part): part is string => Boolean(part))
    : []

  return (
    <Sheet open={conversation !== null} onOpenChange={onOpenChange}>
      <SheetContent container={container} side="right" className="max-w-lg gap-0 bg-white p-0">
        {conversation && (
          <div className="flex h-full flex-col gap-4 overflow-hidden p-6">
            <SheetHeader className="pr-8">
              {/* Test calls have no candidate — title them by what they are
                  rather than by a missing person. */}
              <SheetTitle>
                {conversation.candidate_name ??
                  (conversation.is_test_call ? "Test call" : "Unknown candidate")}
              </SheetTitle>
              {/* Agent \u00b7 date \u00b7 time \u00b7 number, on one line. Duration is
                  deliberately absent \u2014 the audio player below already shows
                  it \u2014 as is a "Test" badge, which the title already says. */}
              <div className="flex items-center gap-x-2 overflow-hidden text-sm whitespace-nowrap text-muted-foreground">
                <span className="truncate">{conversation.agent_name ?? "Unknown agent"}</span>
                {metadata.map((part) => (
                  <React.Fragment key={part}>
                    <span>&middot;</span>
                    <span className="shrink-0 tabular-nums">{part}</span>
                  </React.Fragment>
                ))}
              </div>
            </SheetHeader>

            <ConversationMediaPreview conversation={conversation} />

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto scrollbar-light">
              {conversation.transcript.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No transcript available for this call.
                </p>
              )}
              {conversation.transcript.map((turn, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col gap-1",
                    turn.speaker === "candidate" ? "items-end" : "items-start"
                  )}
                >
                  <span className="text-xs text-muted-foreground">
                    {turn.speaker === "agent"
                      ? (conversation.agent_name ?? "Agent")
                      : (conversation.candidate_name ?? "Candidate")}
                  </span>
                  <p
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                      turn.speaker === "candidate"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {turn.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
