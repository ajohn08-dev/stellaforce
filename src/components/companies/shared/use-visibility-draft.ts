"use client"

import * as React from "react"

import { useDraftField } from "@/components/companies/company-draft-context"
import { useFieldScope } from "@/components/companies/shared/field-scope"
import type { AgentUse, Clearance, VisibilityBlock } from "@/lib/company-visibility"

/**
 * Binds an item's clearance to the company draft buffer.
 *
 * Changing who an item is cleared for **is an edit** — arguably the most
 * consequential one available, since it decides what an agent may say. It was
 * held in local component state, so it never reached the publish buffer: you
 * could open the sentence, move a policy from Recruiters-only to Cleared for
 * candidates, and the header would still read "No changes". The setting looked
 * applied and silently wasn't.
 */
export function useVisibilityDraft(
  idPrefix: string,
  visibility: VisibilityBlock,
  label: string
) {
  const scope = useFieldScope(`${label} access`)

  const [clearance, setAudience] = useDraftField(
    `${idPrefix}-clearance`,
    visibility.clearance,
    scope
  ) as readonly [Clearance, (v: Clearance) => void]

  const [agentUse, setAgentUse] = useDraftField(
    `${idPrefix}-agent-use`,
    visibility.agentUse ?? "",
    scope
  ) as readonly [string, (v: string) => void]

  const onChange = React.useCallback(
    (next: { clearance: Clearance; agentUse: AgentUse | null }) => {
      setAudience(next.clearance)
      setAgentUse(next.agentUse ?? "")
    },
    [setAudience, setAgentUse]
  )

  return {
    clearance,
    agentUse: (agentUse || null) as AgentUse | null,
    onChange,
  }
}
