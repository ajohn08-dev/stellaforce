import { EyeOff, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { InternalNoteCard } from "@/components/companies/shared/internal-note-card"
import {
  RestrictedPanel,
  RestrictedStub,
} from "@/components/companies/shared/restricted-panel"
import {
  SectionEmpty,
  SectionShell,
} from "@/components/companies/workspace/section-shell"
import type { SectionDef } from "@/components/companies/workspace/company-sections"
import type { CompanyReadiness } from "@/lib/company-readiness"
import { briefItems, type Company } from "@/lib/mock-companies"

/**
 * The private account and search context.
 *
 * The banner is not dismissible. This is the tab whose contents would do the most
 * damage if a recruiter mis-remembered its status mid-call, so the reassurance
 * stays on screen the whole time rather than being something you saw once.
 */
export function BriefSection({
  company,
  section,
  readiness,
  canViewRestricted = true,
}: {
  company: Company
  section: SectionDef
  readiness: CompanyReadiness
  canViewRestricted?: boolean
}) {
  const notes = briefItems(company)
  const internal = notes.filter((n) => n.visibility.clearance === "recruiters_only")
  const restricted = notes.filter((n) => n.visibility.clearance === "restricted")

  return (
    <SectionShell
      section={section}
      readiness={readiness}
      bulkItems={internal}
      actions={
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="size-3.5" />
          Add a note
        </Button>
      }
    >
      <p className="flex items-start gap-2.5 rounded-lg border border-border bg-muted p-3 text-sm">
        <EyeOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span>
          <span className="font-medium">Recruiters only.</span>{" "}
          <span className="text-muted-foreground">
            No screening agent ever receives anything on this page. Notes marked
            promotable can be cleared for candidates, which still needs review before
            anything is published.
          </span>
        </span>
      </p>

      {notes.length === 0 ? (
        <SectionEmpty
          title="No internal brief yet"
          prompt="This is where account strategy, hiring-manager preferences, and search constraints live — none of it reaches candidates."
          actionLabel="Add a note"
        />
      ) : (
        <>
          <div className="space-y-3">
            {internal.map((note) => (
              <InternalNoteCard key={note.id} item={note} />
            ))}
          </div>

          {restricted.length > 0 &&
            (canViewRestricted ? (
              <div className="space-y-2">
                {restricted.map((note) => (
                  <RestrictedPanel
                    key={note.id}
                    title={note.title}
                    reason="Limited to the account owner and internal admins."
                  >
                    <p className="text-sm text-muted-foreground">{note.body}</p>
                  </RestrictedPanel>
                ))}
              </div>
            ) : (
              <RestrictedStub count={restricted.length} />
            ))}
        </>
      )}
    </SectionShell>
  )
}
