"use client"

import { useRouter } from "next/navigation"

import { FloatingAskBar } from "@/components/chat/floating-ask-bar"

/**
 * Natural-language candidate search, pinned to the bottom of /candidates.
 *
 * The shared floating bar (`FloatingAskBar` → `AskComposer`), so it is visually
 * identical to the home bar and to the composers on /chat and in the Advanced
 * Search AI tab. It offers no suggested prompts — the placeholder already shows
 * the shape of a query, and this page has no equivalent of home's "here are
 * things you might ask" framing.
 *
 * Sending routes to /candidates/search with the query, where the Advanced
 * Search rail opens on the AI tab, shows the message as already sent, and
 * parses it into filters without a second submission.
 */
export function CandidateAskBar() {
  const router = useRouter()

  return (
    <FloatingAskBar
      placeholder="Find a product designer with fintech experience, open to contract…"
      srLabel="Search candidates in your own words"
      onSend={(message) =>
        router.push(`/candidates/search?q=${encodeURIComponent(message)}`)
      }
    />
  )
}
