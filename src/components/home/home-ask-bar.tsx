"use client"

import { useRouter } from "next/navigation"

import { FloatingAskBar } from "@/components/chat/floating-ask-bar"

/**
 * Home's chat entry point: the shared floating bar, sending to /chat.
 *
 * It replaced a permanently-open composer that occupied a `flex-1` region at
 * the bottom of every home layout — a large, always-present surface for
 * something used occasionally, which pushed the dashboard up and made the
 * suggested prompts read as page furniture rather than an invitation.
 *
 * Everything visual lives in `AskComposer`, so this is identical to the
 * candidates bar apart from the prompts and where it sends.
 */
export function HomeAskBar({ prompts }: { prompts: string[] }) {
  const router = useRouter()

  return (
    <FloatingAskBar
      placeholder="Ask about your pipeline, reqs, or candidates…"
      srLabel="Ask about your pipeline, reqs, or candidates"
      prompts={prompts}
      onSend={(message) => router.push(`/chat?q=${encodeURIComponent(message)}`)}
    />
  )
}
