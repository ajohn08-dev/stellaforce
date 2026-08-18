import Link from "next/link"
import { AlertOctagon, AlertTriangle, ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { FieldScopeProvider } from "@/components/companies/shared/field-scope"
import { SectionVisibilityBar } from "@/components/companies/workspace/section-visibility-bar"
import type { SectionDef } from "@/components/companies/workspace/company-sections"
import type { CompanyReadiness } from "@/lib/company-readiness"
import { summarizeSection, type VisibilityBearing } from "@/lib/company-visibility"

/**
 * The frame every section renders inside: title, what belongs here, the
 * section-wide visibility sentence, any readiness warnings pointing here, then
 * the content.
 *
 * It provides the field scope but owns no publish state: edits are batched
 * across the **whole company** and land in the header's Publish button, so
 * moving between sections mid-edit keeps everything.
 *
 * Warnings render **above the content they concern**, not in a separate readiness
 * screen. That is what dissolving that tab bought: you see the problem in the
 * place you'd fix it.
 */
export function SectionShell({
  section,
  readiness,
  bulkItems,
  actions,
  children,
}: {
  section: SectionDef
  readiness: CompanyReadiness
  /** Items the section-wide visibility sentence applies to. */
  bulkItems?: VisibilityBearing[]
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const warnings = readiness.checks.filter(
    (c) => c.fixSection === section.key && (c.status === "fail" || c.status === "caveat")
  )

  const summary = bulkItems?.length ? summarizeSection(bulkItems) : null
  const dominantAgentUse =
    bulkItems?.find((i) => i.visibility.agentUse)?.visibility.agentUse ?? null

  return (
    <FieldScopeProvider section={section.key}>
      <div className="mx-auto w-full max-w-4xl space-y-5 pb-10">
        <header className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight">{section.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{section.purpose}</p>
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>

          {summary && (
            <SectionVisibilityBar
              clearance={summary.uniformClearance ?? section.clearance}
              agentUse={dominantAgentUse}
              overrideCount={summary.overrideCount}
            />
          )}
        </header>

        {warnings.length > 0 && (
          <ul className="space-y-2">
            {warnings.map((w) => {
              const blocking = w.status === "fail" && w.severity === "critical"
              const Icon = blocking ? AlertOctagon : AlertTriangle
              return (
                <li
                  key={w.key}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border p-3 text-sm",
                    blocking
                      ? "border-destructive/30 bg-destructive/[0.04]"
                      : "border-amber-500/30 bg-amber-50/60 dark:bg-amber-950/20"
                  )}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      blocking ? "text-destructive" : "text-amber-600 dark:text-amber-400"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{w.label}</p>
                    <p className="text-muted-foreground">{w.explanation}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {children}
      </div>
    </FieldScopeProvider>
  )
}

/**
 * A titled group of fields. Sections are read top-to-bottom, so groups get a
 * plain heading and a hairline rather than a heavy card.
 */
export function FieldCard({
  title,
  description,
  children,
  className,
}: {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-lg border border-border", className)}>
      {title && (
        <div className="border-b border-border px-4 py-2.5">
          <h3 className="text-sm font-medium">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

/**
 * The standard "nothing here yet" block. Takes the prompt for what to write and
 * why it matters, never a bare "No data" — an empty company profile after an
 * intake call is the normal state of the world, not a mistake.
 */
export function SectionEmpty({
  title,
  prompt,
  actionLabel,
  href,
}: {
  title: string
  prompt: string
  actionLabel?: string
  href?: string
}) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{prompt}</p>
      {actionLabel && (
        <p className="mt-3">
          <Link
            href={href ?? "#"}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {actionLabel}
            <ArrowRight className="size-3.5" />
          </Link>
        </p>
      )}
    </div>
  )
}
