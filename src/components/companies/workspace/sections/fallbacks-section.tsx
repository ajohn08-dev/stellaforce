"use client"

import { MessageCircleOff } from "lucide-react"

import { EditableTextarea } from "@/components/companies/shared/editable-field"
import { draftKey } from "@/lib/company-draft-keys"
import { SectionNote } from "@/components/companies/shared/section-note"
import { SectionShell } from "@/components/companies/workspace/section-shell"
import type { SectionDef } from "@/components/companies/workspace/company-sections"
import type { CompanyReadiness } from "@/lib/company-readiness"
import { GLOBAL_FALLBACKS, isCustomised, resolveFallbacks } from "@/lib/fallbacks"
import type { Company } from "@/lib/mock-companies"

/**
 * **What the agent says when it can't answer** — four sentences, company-wide.
 *
 * Its own destination rather than a block inside a topic, because these aren't
 * facts about the company: they're how its agent speaks. And deliberately *not*
 * per section or per question — a fallback per topic is a hundred sentences
 * nobody maintains and an agent whose voice changes depending on what it was
 * asked.
 *
 * Four rather than one, because the single sentence this replaces —
 * *"I don't have a confirmed answer"* — was the wrong thing to say in three of
 * the four situations. It's a lie when we know the band and won't quote it, and
 * it's cold when the candidate isn't asking a question at all.
 *
 * This is the counterpart to the prohibitions. "Never confirm a figure" without
 * a sentence to say instead leaves the agent improvising at exactly the moment
 * it must not.
 */
export function FallbacksSection({
  company,
  section,
  readiness,
}: {
  company: Company
  section: SectionDef
  readiness: CompanyReadiness
}) {
  const resolved = resolveFallbacks(company.fallbacks)

  return (
    <SectionShell section={section} readiness={readiness}>
      <SectionNote kind="rule">
        These four cover every conversation, at every role. They start as
        Stellaforce&apos;s wording; edit any of them to sound like this company.
        There is deliberately no per-topic version — an agent that declines
        differently depending on the subject sounds like it&apos;s hiding
        something.
      </SectionNote>

      <div className="space-y-3">
        {resolved.map((fallback) => {
          const custom = isCustomised(fallback.kind, company.fallbacks)
          return (
            <section
              key={fallback.kind}
              className="space-y-2 rounded-lg border border-border p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <MessageCircleOff className="size-4 shrink-0 text-muted-foreground" />
                  {fallback.label}
                </h3>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {custom ? "Reworded for this company" : "Stellaforce default"}
                </span>
              </div>

              <p className="text-xs text-muted-foreground">{fallback.when}</p>

              <EditableTextarea
                fieldKey={draftKey.fallback(fallback.kind)}
                value={fallback.text}
                label={`Fallback — ${fallback.label}`}
                ariaLabel={`What the agent says when: ${fallback.label}`}
                rows={2}
              />

              {custom && (
                // Losing the default wording once someone edits it would make
                // "put it back" impossible without asking us.
                <p className="text-xs text-muted-foreground">
                  Stellaforce default: “{GLOBAL_FALLBACKS[fallback.kind].text}”
                </p>
              )}
            </section>
          )
        })}
      </div>
    </SectionShell>
  )
}
