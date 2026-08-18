"use client"

import * as React from "react"
import { MessageCircleQuestion, UserPlus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  SectionEmpty,
  SectionShell,
} from "@/components/companies/workspace/section-shell"
import { formatDate } from "@/lib/constants"
import type { SectionDef } from "@/components/companies/workspace/company-sections"
import type { CompanyReadiness } from "@/lib/company-readiness"
import {
  KNOWLEDGE_GAP_STATUS_LABELS,
  type Company,
  type KnowledgeGap,
  type KnowledgeLevel,
} from "@/lib/mock-companies"

const LEVEL_LABELS: Record<KnowledgeLevel, string> = {
  company: "Company",
  department: "Department",
  team: "Team",
  job: "This role",
}

const LEVEL_CONSEQUENCE: Record<KnowledgeLevel, string> = {
  company: "Applies to every job at this company.",
  department: "Applies to every job in that department.",
  team: "Applies to every job on that team.",
  job: "Applies to this role only.",
}

/**
 * Questions candidates asked that approved knowledge couldn't answer — the
 * knowledge base's own to-do list, written by candidates rather than guessed at.
 *
 * Choosing a level is the consequential decision here, so each option states
 * what it implies. Getting it wrong doesn't just misfile the answer; it decides
 * how many future jobs inherit it.
 */
export function UnansweredSection({
  company,
  section,
  readiness,
}: {
  company: Company
  section: SectionDef
  readiness: CompanyReadiness
}) {
  const open = company.gaps
    .filter((g) => g.status !== "resolved" && g.status !== "wont_answer")
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount)

  return (
    <SectionShell section={section} readiness={readiness}>
      {open.length === 0 ? (
        <SectionEmpty
          title="No unanswered questions"
          prompt="Anything a candidate asks that approved knowledge can't cover will appear here, ranked by how often it comes up."
        />
      ) : (
        <ul className="space-y-3">
          {open.map((gap) => (
            <GapCard key={gap.id} gap={gap} />
          ))}
        </ul>
      )}
    </SectionShell>
  )
}

function GapCard({ gap }: { gap: KnowledgeGap }) {
  const [level, setLevel] = React.useState<KnowledgeLevel>(gap.proposedLevel)

  return (
    <li className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{gap.sourceQuestion}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Asked {gap.occurrenceCount}× · first {formatDate(gap.firstAskedAt)} · last{" "}
              {formatDate(gap.lastAskedAt)}
            </p>
          </div>
        </div>
        <Badge variant="outline">{KNOWLEDGE_GAP_STATUS_LABELS[gap.status]}</Badge>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          Where should this answer live?
        </p>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(LEVEL_LABELS) as KnowledgeLevel[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLevel(l)}
              className={cn(
                "rounded-md border px-2 py-1 text-xs transition-colors",
                level === l
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{LEVEL_CONSEQUENCE[level]}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button size="sm" variant="outline" className="gap-1.5">
          Draft an answer
        </Button>
        <Button size="sm" variant="ghost" className="gap-1.5">
          <UserPlus className="size-3.5" />
          {gap.assignedOwner ? `Assigned to ${gap.assignedOwner}` : "Assign an owner"}
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground">
          Won&apos;t answer
        </Button>
      </div>
    </li>
  )
}
