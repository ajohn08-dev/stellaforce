"use client"

import * as React from "react"
import { MessageCircle } from "lucide-react"

import { HomeChatPanel } from "@/components/home/home-chat-panel"
import { cn } from "@/lib/utils"
import { MOCK_CHAT_HISTORY } from "@/lib/mock-chat-history"

const SUGGESTED_PROMPTS = [
  "What's moving across my reqs today?",
  "Show me anything at risk of SLA breach",
  "Summarize this week's momentum",
]

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
}

/** UI-only placeholder — no backend yet, so the assistant side is a canned reply. */
const ASSISTANT_PLACEHOLDER_REPLY = "This is a UI preview — live answers aren't wired up yet."

/** UI-only placeholder — history rail is mock data, conversation has no backend yet. */
export default function ChatPage() {
  const [selectedId, setSelectedId] = React.useState<string | undefined>(undefined)
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const bottomRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [messages])

  function handleSend(text: string) {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text },
      { id: crypto.randomUUID(), role: "assistant", text: ASSISTANT_PLACEHOLDER_REPLY },
    ])
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className="flex w-64 shrink-0 flex-col gap-1 overflow-y-auto p-3 no-scrollbar">
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Chat History</p>
        {MOCK_CHAT_HISTORY.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setSelectedId(entry.id)}
            className={cn(
              "flex flex-col gap-0.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/50",
              selectedId === entry.id && "bg-accent"
            )}
          >
            <span className="truncate text-sm font-medium text-muted-foreground">{entry.title}</span>
            <span className="text-xs text-muted-foreground">{entry.timestamp}</span>
          </button>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <MessageCircle className="size-6" />
              <p className="text-sm">Ask a question below to get started</p>
            </div>
          ) : (
            <div className="mx-auto flex w-[50vw] flex-col gap-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="h-40 shrink-0 pt-4">
          <HomeChatPanel prompts={SUGGESTED_PROMPTS} onSend={handleSend} />
        </div>
      </div>
    </div>
  )
}
