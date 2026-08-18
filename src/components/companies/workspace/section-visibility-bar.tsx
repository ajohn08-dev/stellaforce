"use client"

import { SectionVisibilitySentence } from "@/components/companies/shared/visibility-sentence"
import type { AgentUse, Clearance } from "@/lib/company-visibility"

/**
 * A **read-only** summary of how the items in this section are cleared.
 *
 * It used to be editable, and that was a lie: the control held its own state, so
 * "set everything here to Recruiters only" changed the sentence, touched no
 * item, and registered no pending change. It looked like the most powerful
 * control on the page and did nothing at all.
 *
 * A working bulk apply has to write every item in the section into the draft
 * buffer and decide what happens to items a human deliberately set differently.
 * Until that exists, this states the current state and clearance is changed
 * per item, where it does work.
 */
export function SectionVisibilityBar({
  clearance,
  agentUse,
  overrideCount,
}: {
  clearance: Clearance
  agentUse: AgentUse | null
  overrideCount: number
}) {
  return (
    <SectionVisibilitySentence
      clearance={clearance}
      agentUse={agentUse}
      overrideCount={overrideCount}
    />
  )
}
