"use client"

import * as React from "react"
import {
  Ban,
  ChevronDown,
  ChevronRight,
  History,
  RotateCcw,
  Sparkles,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useCompanyDraft } from "@/components/companies/company-draft-context"
import { ALL_SECTIONS } from "@/components/companies/workspace/company-sections"
import { formatTimestamp } from "@/components/companies/shared/activity-row"
import { cn } from "@/lib/utils"
import type { CompiledAgentContext } from "@/lib/company-agent-context"
import type { CompanyReadiness } from "@/lib/company-readiness"
import type { CompanyVersion } from "@/lib/mock-companies"

function sectionLabel(key: string): string {
  return ALL_SECTIONS.find((s) => s.key === key)?.label ?? key
}

/**
 * **Publish is the primary action of the workspace** — nothing a recruiter edits
 * reaches an agent until they press it.
 *
 * It lives in the header rather than at the bottom of a section because the
 * buffer spans the whole company: you can edit the profile, then benefits, then
 * a question, and the count follows you across every section.
 *
 * Publishing shows what's about to change first. With edits batched across four
 * or five sections, a bare confirm would ask you to remember what you did twenty
 * minutes ago — the review list is what makes company-wide batching safe rather
 * than merely convenient.
 */
export function PublishButton({
  context,
  readiness,
  versions,
}: {
  context: CompiledAgentContext
  readiness: CompanyReadiness
  versions: CompanyVersion[]
}) {
  const draft = useCompanyDraft()
  const count = draft?.changes.length ?? 0
  const [historyOpen, setHistoryOpen] = React.useState(false)

  const grouped = React.useMemo(() => {
    const map = new Map<string, string[]>()
    for (const c of draft?.changes ?? []) {
      map.set(c.section, [...(map.get(c.section) ?? []), c.label])
    }
    return [...map.entries()]
  }, [draft?.changes])

  /**
   * Version history rides in the split button's menu rather than sitting beside
   * it: it's a rarely-used companion to publishing (what did we publish before?)
   * and a second top-level button was competing with the primary action.
   *
   * With nothing to publish, only the publish half goes disabled — the menu half
   * stays live, since looking at what was published before is exactly what you
   * do on a company with no pending edits.
   */
  const menu = (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="sm"
              aria-label="More publish actions"
              className="rounded-l-none border-l border-l-primary-foreground/25 px-1.5"
            >
              <ChevronDown className="size-3.5" />
            </Button>
          }
        />
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
            <History className="size-4" />
            Version history
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CompanyVersionHistory
        versions={versions}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </>
  )

  if (count === 0) {
    return (
      <div className="flex items-center">
        <Button size="sm" disabled className="rounded-r-none">
          Publish
        </Button>
        {menu}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground"
        onClick={() => draft?.discardAll()}
      >
        <RotateCcw className="size-3.5" />
        Discard
      </Button>

      <Dialog>
        <div className="flex items-center">
          <DialogTrigger
            render={
              <Button size="sm" className="rounded-r-none">
                Publish {count} change{count === 1 ? "" : "s"}
              </Button>
            }
          />
          {menu}
        </div>
        <DialogContent className="max-h-[80vh] w-full max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Publish {count} change{count === 1 ? "" : "s"}
            </DialogTitle>
            <DialogDescription>
              Screening agents pick these up immediately. Anything still marked
              unconfirmed stays flagged until someone verifies it.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-3">
            {grouped.map(([section, labels]) => (
              <li key={section}>
                <p className="text-xs font-medium text-muted-foreground">
                  {sectionLabel(section)}
                </p>
                <ul className="mt-1 space-y-1">
                  {labels.map((label) => (
                    <li key={label} className="text-sm">
                      {label}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <AgentContextDisclosure context={context} readiness={readiness} />

          <DialogFooter>
            <DialogClose render={<Button variant="ghost">Keep editing</Button>} />
            <DialogClose
              render={<Button onClick={() => draft?.publishAll()}>Publish</Button>}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Published versions of the whole company profile.
 *
 * **UI only in this demo** — the list is mock and nothing restores. It's
 * company-wide by design: a publish is one atomic act across every section, so a
 * version is a snapshot of the company, not of a section or an item.
 *
 * Opened from the publish split button's menu, so it takes its open state from
 * the caller rather than owning a trigger of its own.
 */
function CompanyVersionHistory({
  versions,
  open,
  onOpenChange,
}: {
  versions: CompanyVersion[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            Every publish snapshots the whole company profile.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          <p className="mb-3 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            Preview only — restoring and diffing land with the database work.
          </p>

          {versions.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Never published. Nothing here has reached an agent yet.
            </p>
          )}

          <ol className="space-y-1">
            {versions.map((v, i) => (
              <li key={v.id} className="rounded-lg px-2 py-2.5 hover:bg-muted/50">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    {i === 0 ? "Current" : `Version ${versions.length - i}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(v.publishedAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {v.changeCount} change{v.changeCount === 1 ? "" : "s"} ·{" "}
                  {v.publishedBy}
                </p>
                {v.summary && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{v.summary}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      </SheetContent>
    </Sheet>
  )
}


/**
 * "What agents will know after this" — collapsed by default, inside the publish
 * dialog.
 *
 * This is the whole of what used to be a separate **Deploy agent** action. That
 * action was fiction: agents attach to a job stage
 * (`job_workflow_sub_stages.agent_id`), never to a company, so there was nothing
 * at this level to deploy. Publishing *is* the moment company knowledge becomes
 * available to every agent running on that company's jobs — so the preview of
 * what they'll receive belongs here, at the moment it becomes true, and nowhere
 * else.
 *
 * It stays collapsed because most publishes are a typo fix, and expanding a
 * seventeen-block context dump for those would train people to skip the dialog.
 */
function AgentContextDisclosure({
  context,
  readiness,
}: {
  context: CompiledAgentContext
  readiness: CompanyReadiness
}) {
  const [open, setOpen] = React.useState(false)
  const excluded =
    context.excluded.internal +
    context.excluded.restricted +
    context.excluded.unpublished

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 p-3 text-left"
      >
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            What agents will know after this
          </span>
          <span className="block text-xs text-muted-foreground">
            {context.blocks.length} blocks · {context.answers.length} answers ·{" "}
            {context.policies.length} policies · {context.escalations.length} handed
            back to you{excluded > 0 ? ` · ${excluded} withheld` : ""}
          </span>
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-3">
          {readiness.status !== "ready" && (
            <p className="rounded-md bg-muted p-2.5 text-xs text-muted-foreground">
              {readiness.headline}
            </p>
          )}

          <ContextGroup title="It can say" icon={<Sparkles className="size-3.5" />}>
            {[
              ...context.blocks.map((b) => ({ id: b.id, text: b.heading })),
              ...context.policies.map((p) => ({ id: p.id, text: p.label })),
              ...context.answers.map((a) => ({ id: a.id, text: a.question })),
            ].map((i) => (
              <li key={i.id}>{i.text}</li>
            ))}
          </ContextGroup>

          {context.escalations.length > 0 && (
            <ContextGroup
              title="It hands back to you"
              icon={<Ban className="size-3.5" />}
            >
              {context.escalations.map((e) => (
                <li key={e.id}>{e.topic}</li>
              ))}
            </ContextGroup>
          )}

          {excluded > 0 && (
            <p className="text-xs text-muted-foreground">
              {excluded} items withheld — {context.excluded.internal} recruiters-only,{" "}
              {context.excluded.restricted} restricted,{" "}
              {context.excluded.unpublished} unpublished. Their contents aren&apos;t
              shown here.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ContextGroup({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {title}
      </p>
      <ul className="ml-5 list-disc space-y-0.5 text-xs text-muted-foreground">
        {children}
      </ul>
    </div>
  )
}
