"use client"

import * as React from "react"
import { ArrowRight, MoreHorizontal, Sparkles } from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
import { EditableTextarea } from "@/components/companies/shared/editable-field"
import { ClearanceBadge } from "@/components/companies/shared/clearance-badge"
import type { KnowledgeItem } from "@/lib/mock-companies"

/**
 * An internal recruiter note. Never candidate-visible, never in agent context.
 *
 * Notes flagged `promotable` get the clear-for-candidates action — the one
 * sanctioned bridge from recruiters-only knowledge to something an agent may
 * say. It deliberately produces a **draft**: the internal phrasing is almost
 * never safe to repeat verbatim ("reschedules a third of the time" becomes "the
 * first round occasionally moves"), so a human has to rewrite it and a second
 * one has to publish it.
 */
export function InternalNoteCard({ item }: { item: KnowledgeItem }) {
  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-medium">{item.title}</h3>
        <div className="flex shrink-0 items-center gap-1">
          <ClearanceBadge clearance={item.visibility.clearance} />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${item.title}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Mark verified</DropdownMenuItem>
              <DropdownMenuItem>Archive</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <EditableTextarea
        fieldKey={`note-${item.id}`}
        value={item.body}
        ariaLabel={item.title}
      />

      {item.promotable && (
        <div className="flex justify-end">
          <PromoteToDraftDialog item={item} />
        </div>
      )}
    </section>
  )
}

function PromoteToDraftDialog({ item }: { item: KnowledgeItem }) {
  const [draft, setDraft] = React.useState("")

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
            <Sparkles className="size-3.5" />
            Clear this for candidates
          </Button>
        }
      />
      <DialogContent className="w-full max-w-3xl">
        <DialogHeader>
          <DialogTitle>Clear this for candidates</DialogTitle>
          <DialogDescription>
            Creates a draft for review. No agent receives it until it is approved and
            published.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Recruiters only — stays private
            </p>
            <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              {item.body}
            </div>
          </div>

          <div className="hidden items-center sm:flex">
            <ArrowRight className="size-4 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Candidate-facing rewrite
            </p>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              placeholder="Rewrite this in words a candidate can hear. Drop the internal framing, keep what's true and useful."
              aria-label="Candidate-facing rewrite"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <DialogClose
            render={<Button disabled={!draft.trim()}>Create draft</Button>}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
