"use client"

import * as React from "react"
import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { EditableTextarea } from "@/components/companies/shared/editable-field"
import { TrustWarning } from "@/components/companies/shared/trust-warning"
import { VisibilitySentence } from "@/components/companies/shared/visibility-sentence"
import { draftKey } from "@/lib/company-draft-keys"
import { useVisibilityDraft } from "@/components/companies/shared/use-visibility-draft"
import type { KnowledgeItem } from "@/lib/mock-companies"

/** Past this, agents start rambling; we nudge toward splitting into a question. */
const LONG_BODY = 800

/**
 * One candidate-safe content block, edited in place.
 *
 * There is no separate edit mode and no save button per card — you click into the
 * text and type, and the section's publish bar collects the changes. A recruiter
 * filling this in after an intake call is making a dozen small edits across
 * several sections, and a modal per field would make that unbearable.
 */
export function KnowledgeCard({
  item,
  prompt,
  today,
}: {
  item: KnowledgeItem
  /** Shown as placeholder when the body is empty — what to write and why. */
  prompt?: string
  today: Date
}) {
  const visibility = useVisibilityDraft(
    draftKey.knowledge(item.id),
    item.visibility,
    item.title
  )

  const isEmpty = !item.body.trim()

  return (
    <section
      className={cn(
        "space-y-3 rounded-lg border p-4",
        isEmpty ? "border-dashed border-border bg-muted/20" : "border-border"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{item.title}</h3>
        {isEmpty && (
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
            <Sparkles className="size-3.5" />
            Draft with AI
          </Button>
        )}
      </div>

      <EditableTextarea
        fieldKey={draftKey.knowledge(item.id)}
        value={item.body}
        placeholder={prompt ?? "Nothing written yet"}
        ariaLabel={item.title}
      />

      {item.body.length > LONG_BODY && (
        <p className="text-xs text-muted-foreground">
          {item.body.length} characters. Long blocks make agents ramble — consider
          splitting this into a candidate question.
        </p>
      )}

      <TrustWarning item={item} today={today} />

      <div className="border-t border-border pt-3">
        <VisibilitySentence
          clearance={visibility.clearance}
          agentUse={visibility.agentUse}
          onChange={visibility.onChange}
        />
      </div>
    </section>
  )
}
