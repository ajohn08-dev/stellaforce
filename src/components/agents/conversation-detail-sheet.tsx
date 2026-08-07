"use client"

import * as React from "react"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { MockConversation } from "@/lib/mock-conversations"

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
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
  conversation: MockConversation | null
  onOpenChange: (open: boolean) => void
}) {
  // Unlike candidate-profile-sheet.tsx (only ever mounted client-side via an
  // intercepted route), this Sheet renders inline in a normal page, so it
  // goes through SSR where `document` doesn't exist — guard instead of
  // stashing in state; getElementById is cheap/referentially stable, and the
  // Sheet starts closed so this can't affect hydration output.
  const container =
    typeof document !== "undefined" ? (document.getElementById("app-content") ?? undefined) : undefined

  return (
    <Sheet open={conversation !== null} onOpenChange={onOpenChange}>
      <SheetContent container={container} side="right" className="max-w-lg gap-0 bg-white p-0">
        {conversation && (
          <div className="flex h-full flex-col gap-4 overflow-hidden p-6">
            <SheetHeader className="pr-8">
              <SheetTitle>{conversation.candidate_name}</SheetTitle>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>{conversation.agent_name}</span>
                <span>&middot;</span>
                <span>{formatDate(conversation.started_at)}</span>
                <span>&middot;</span>
                <span>{formatDuration(conversation.duration_seconds)}</span>
                {conversation.is_test_call && (
                  <Badge variant="outline" className="ml-1">
                    Test
                  </Badge>
                )}
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto scrollbar-light">
              {conversation.transcript.map((turn, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col gap-1",
                    turn.speaker === "candidate" ? "items-end" : "items-start"
                  )}
                >
                  <span className="text-xs text-muted-foreground">
                    {turn.speaker === "agent" ? conversation.agent_name : conversation.candidate_name}
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
