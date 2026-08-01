"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Search, UserPlus } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addCandidateToPipeline } from "@/app/(app)/jobs/actions"

export type JobCandidateOption = { id: string; name: string; title: string }

/**
 * Picks an existing candidate from the roster and attaches them to this job's
 * pipeline (→ `addCandidateToPipeline`, which creates the `applications` row at
 * the first stage). Only candidates not already in the pipeline are listed
 * (filtered server-side).
 */
export function AddCandidateToJobDialog({
  jobId,
  candidates,
}: {
  jobId: string
  candidates: JobCandidateOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [addingId, setAddingId] = React.useState<string | null>(null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter(
      (c) => c.name.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
    )
  }, [candidates, query])

  async function add(candidateId: string) {
    setAddingId(candidateId)
    const res = await addCandidateToPipeline(jobId, candidateId)
    setAddingId(null)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success("Candidate added to the pipeline.")
    router.refresh()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="gap-1.5">
            <UserPlus className="size-4" />
            Add candidate
          </Button>
        }
      />
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a candidate to this job</DialogTitle>
          <DialogDescription>
            Attaching a candidate creates an application at the first pipeline stage.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search candidates…"
            className="pl-8"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {candidates.length === 0
                ? "Every candidate is already in this pipeline."
                : "No candidates match your search."}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {filtered.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    {c.title && (
                      <p className="truncate text-xs text-muted-foreground">{c.title}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={addingId !== null}
                    onClick={() => add(c.id)}
                  >
                    {addingId === c.id ? "Adding…" : "Add"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
