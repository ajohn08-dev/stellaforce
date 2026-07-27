"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { FileSpreadsheet, ClipboardList, FileText, X } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { FileDropZone } from "@/components/candidates/file-drop-zone"
import { ResumeValidationError, validateResumeFile } from "@/lib/resume-upload"
import { useResumeUploadQueue } from "@/lib/resume-upload-queue"
import { RESUME_ACCEPT } from "@/lib/constants"

type Method = "resume" | "csv"

const COPY: Record<Method, { title: string; description: string }> = {
  resume: {
    title: "Add a candidate",
    description:
      "Drop resumes and we'll pre-fill a draft for each one — track progress in the corner tray after you continue.",
  },
  csv: {
    title: "Bulk upload candidates",
    description:
      "Drop a CSV and each row becomes a draft candidate for you to review.",
  },
}

/**
 * Resume upload is the default/primary ingestion method; CSV and manual
 * entry are offered as alternatives below it. This dialog only picks files —
 * clicking Continue hands them to the global resume-upload queue
 * (`useResumeUploadQueue`), which uploads + parses them one at a time and
 * tracks progress in a persistent tray (`ResumeUploadTray`) that survives
 * this dialog closing and outlives page navigation. CSV upload is still an
 * honest stub — no CSV parsing exists yet.
 */
export function AddCandidateDialog() {
  const [open, setOpen] = React.useState(false)
  const [method, setMethod] = React.useState<Method>("resume")
  const [resumeFiles, setResumeFiles] = React.useState<File[]>([])
  const [csvFile, setCsvFile] = React.useState<File | null>(null)
  const { enqueueFiles } = useResumeUploadQueue()

  function resetState() {
    setMethod("resume")
    setResumeFiles([])
    setCsvFile(null)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) resetState()
  }

  function handleFilesSelected(newFiles: File[]) {
    const validated: File[] = []
    for (const file of newFiles) {
      try {
        validateResumeFile(file)
      } catch (err) {
        const message =
          err instanceof ResumeValidationError ? err.message : "Invalid file."
        toast.error(`${file.name}: ${message}`)
        continue
      }
      validated.push(file)
    }
    if (validated.length > 0) {
      setResumeFiles((prev) => [...prev, ...validated])
    }
  }

  function removeResumeFile(index: number) {
    setResumeFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function handleResumeContinue() {
    if (resumeFiles.length === 0) return
    enqueueFiles(resumeFiles)
    handleOpenChange(false)
  }

  const copy = COPY[method]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button>Add Candidate</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        {method === "resume" ? (
          <>
            <FileDropZone
              multiple
              accept={RESUME_ACCEPT}
              hint="PDF, DOC, or DOCX — drop multiple to add them all"
              onFilesSelected={handleFilesSelected}
            />

            {resumeFiles.length > 0 && (
              <ul className="grid h-64 auto-rows-[5rem] grid-cols-3 gap-2 overflow-y-auto">
                {resumeFiles.map((file, index) => (
                  <li
                    key={`${file.name}-${file.lastModified}-${index}`}
                    className="relative flex flex-col justify-center gap-1 rounded-lg border border-border p-2"
                  >
                    <button
                      type="button"
                      aria-label="Remove file"
                      onClick={() => removeResumeFile(index)}
                      className="absolute top-1 right-1 shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                    <FileText className="size-5 shrink-0 text-brand-purple-600" />
                    <p className="truncate pr-4 text-xs font-medium">{file.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(file.size / 1024).toFixed(0)} KB
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <FileDropZone
            accept=".csv"
            hint="CSV, one candidate per row"
            file={csvFile}
            onFileChange={setCsvFile}
          />
        )}

        <Button
          disabled={method === "resume" ? resumeFiles.length === 0 : !csvFile}
          onClick={
            method === "resume"
              ? handleResumeContinue
              : () => toast.info("Not wired up yet — parsing is coming soon.")
          }
        >
          Continue
        </Button>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {method === "resume" ? (
            <Button
              variant="outline"
              onClick={() => {
                setResumeFiles([])
                setMethod("csv")
              }}
            >
              <FileSpreadsheet className="size-4" />
              CSV upload
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                setCsvFile(null)
                setMethod("resume")
              }}
            >
              Resume upload
            </Button>
          )}
          <Link
            href="/candidates/new"
            className={buttonVariants({ variant: "outline" })}
            onClick={() => handleOpenChange(false)}
          >
            <ClipboardList className="size-4" />
            Manual form
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
