"use client"

import * as React from "react"
import { toast } from "sonner"
import { FileText, Upload, X } from "lucide-react"

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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MOCK_JOB_CLIENTS } from "@/lib/mock-jobs"

const EMPTY_FORM = {
  title: "",
  client_name: "",
  location: "",
  description: "",
  notes: "",
}

/** Compact upload affordance — a button when empty, a removable filename chip once a file is picked. */
function InlineFileUpload({
  file,
  onFileChange,
  label,
}: {
  file: File | null
  onFileChange: (file: File | null) => void
  label: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  if (file) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{file.name}</span>
        <button
          type="button"
          aria-label="Remove file"
          onClick={() => onFileChange(null)}
          className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    )
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-3.5" />
        {label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="sr-only"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
    </>
  )
}

/**
 * UI preview only — this is a static array (src/lib/mock-jobs.ts), not the
 * job_orders table, so "Create job" is an honest stub rather than a write.
 * File uploads are selected but not parsed/stored anywhere yet.
 */
export function AddJobDialog() {
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY_FORM)
  const [descriptionFile, setDescriptionFile] = React.useState<File | null>(null)
  const [requisitionFile, setRequisitionFile] = React.useState<File | null>(null)
  const [notesFile, setNotesFile] = React.useState<File | null>(null)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setForm(EMPTY_FORM)
      setDescriptionFile(null)
      setRequisitionFile(null)
      setNotesFile(null)
    }
  }

  const hasDescription = form.description.trim().length > 0 || descriptionFile !== null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button>Add Job</Button>} />
      <DialogContent className="flex max-h-[85vh] flex-col overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a job</DialogTitle>
          <DialogDescription>
            Create a new job order for a client.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Job title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Senior Full-Stack Engineer"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Client</Label>
              <Select
                value={form.client_name}
                onValueChange={(v) => setForm({ ...form, client_name: v ?? "" })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_JOB_CLIENTS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Location</Label>
              <Input
                value={form.location}
                onChange={(e) =>
                  setForm({ ...form, location: e.target.value })
                }
                placeholder="Remote (US)"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Job description (required)</Label>
              <InlineFileUpload
                file={descriptionFile}
                onFileChange={setDescriptionFile}
                label="Upload"
              />
            </div>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Paste the job description…"
              className="min-h-24"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Requisition (optional)</Label>
            <InlineFileUpload
              file={requisitionFile}
              onFileChange={setRequisitionFile}
              label="Upload requisition"
            />
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Notes (recommended)</Label>
              <InlineFileUpload
                file={notesFile}
                onFileChange={setNotesFile}
                label="Upload"
              />
            </div>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Paste any additional notes…"
              className="min-h-24"
            />
          </div>
        </div>

        <Button
          disabled={!form.title || !form.client_name || !hasDescription}
          onClick={() => {
            toast.info("Not wired up yet — job creation is coming soon.")
            handleOpenChange(false)
          }}
        >
          Create job
        </Button>
      </DialogContent>
    </Dialog>
  )
}
