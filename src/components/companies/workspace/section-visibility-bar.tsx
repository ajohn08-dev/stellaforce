"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { useCompanyDraft } from "@/components/companies/company-draft-context"
import { useFieldScope } from "@/components/companies/shared/field-scope"
import { SectionVisibilitySentence } from "@/components/companies/shared/visibility-sentence"
import {
  summarizeSection,
  type AgentUse,
  type Clearance,
  type VisibilityBlock,
} from "@/lib/company-visibility"

/**
 * One item a bulk change can write to.
 *
 * `key` is the item's **draft-field prefix** — `faq-q-benefits`,
 * `policy-pol-lg-03`, `knowledge-ki-lg-01`, `team-team-lg-gtm`. It has to be the
 * same prefix the item's own `VisibilitySentence` binds to, or a bulk change
 * would write somewhere nothing reads and the section would claim a change no
 * item ever made.
 */
export type BulkVisibilityItem = {
  key: string
  label: string
  visibility: VisibilityBlock
}

/**
 * "Everything here is…" — **and now it means it.**
 *
 * This was read-only for a while, and honestly so: an earlier version held its
 * own state, so "set everything here to Recruiters only" changed the sentence,
 * touched no item, and registered no pending change. It looked like the most
 * powerful control on the page and did nothing at all. Rather than fake it, it
 * was frozen until a real bulk apply existed.
 *
 * This is that. Picking a clearance writes every item in the section into the
 * company draft buffer under the same keys the per-item sentences use, so the
 * change shows on each item, counts toward Publish, and reverts with Discard.
 *
 * **Items a human deliberately set are left alone by default.** That's the whole
 * difficulty of a bulk control: someone moved the sponsorship answer to
 * Recruiters-only on purpose, and a section-wide "cleared for candidates" that
 * silently undid it would be the most dangerous click in the product. They're
 * reported, and including them is a second, explicit click.
 */
export function SectionVisibilityBar({ items }: { items: BulkVisibilityItem[] }) {
  const draft = useCompanyDraft()
  const scope = useFieldScope("")

  // Read through the draft buffer so the sentence reflects unpublished changes —
  // including the one you just made here.
  const effective = items.map((item) => {
    const clearance = (draft?.get(`${item.key}-clearance`) ??
      item.visibility.clearance) as Clearance
    const agentUseRaw = draft?.get(`${item.key}-agent-use`)
    const agentUse = (
      agentUseRaw === undefined ? item.visibility.agentUse : agentUseRaw || null
    ) as AgentUse | null
    return { ...item, visibility: { ...item.visibility, clearance, agentUse } }
  })

  const summary = summarizeSection(effective)
  const dominantAgentUse = effective.find((i) => i.visibility.agentUse)?.visibility.agentUse ?? null

  const [lastApplied, setLastApplied] = React.useState<{
    clearance: Clearance
    agentUse: AgentUse | null
  } | null>(null)

  function apply(
    next: { clearance: Clearance; agentUse: AgentUse | null },
    includeDeliberate: boolean
  ) {
    for (const item of items) {
      if (!includeDeliberate && !item.visibility.isPresetDefault) continue
      draft?.set(`${item.key}-clearance`, next.clearance, item.visibility.clearance, {
        section: scope.section,
        label: `${item.label} access`,
      })
      draft?.set(
        `${item.key}-agent-use`,
        next.agentUse ?? "",
        item.visibility.agentUse ?? "",
        { section: scope.section, label: `${item.label} access` }
      )
    }
    setLastApplied(next)
  }

  if (items.length === 0) return null

  return (
    <div className="space-y-1.5">
      <SectionVisibilitySentence
        clearance={summary.uniformClearance ?? effective[0].visibility.clearance}
        agentUse={dominantAgentUse}
        overrideCount={summary.overrideCount}
        mixed={summary.isMixed}
        onChange={(next) => apply(next, false)}
      />

      {lastApplied && summary.overrideCount > 0 && (
        <p className="flex flex-wrap items-center gap-2 pl-3 text-xs text-muted-foreground">
          {summary.overrideCount} item{summary.overrideCount === 1 ? "" : "s"} kept
          their own setting.
          <Button
            variant="ghost"
            size="xs"
            className="text-xs"
            onClick={() => apply(lastApplied, true)}
          >
            Apply to those too
          </Button>
        </p>
      )}
    </div>
  )
}
