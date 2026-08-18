"use client"

import { VisibilitySentence } from "@/components/companies/shared/visibility-sentence"
import { useVisibilityDraft } from "@/components/companies/shared/use-visibility-draft"
import type { VisibilityBlock } from "@/lib/company-visibility"

/**
 * The editable visibility sentence for an item whose surrounding card is a
 * server component.
 *
 * Teams had a read-only `ClearanceBadge`, which was fine until the section-wide
 * control became real: a bulk change writes `team-<id>-clearance` into the draft
 * buffer, and with no editor bound to that key the change would have been
 * invisible on the item it changed. A badge that can't move while the thing it
 * describes does is worse than no badge.
 */
export function ItemVisibility({
  idPrefix,
  visibility,
  label,
}: {
  idPrefix: string
  visibility: VisibilityBlock
  label: string
}) {
  const draft = useVisibilityDraft(idPrefix, visibility, label)

  return (
    <VisibilitySentence
      clearance={draft.clearance}
      agentUse={draft.agentUse}
      onChange={draft.onChange}
      className="text-xs"
    />
  )
}
