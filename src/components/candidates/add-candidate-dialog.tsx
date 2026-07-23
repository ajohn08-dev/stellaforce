"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { FileSpreadsheet, ClipboardList } from "lucide-react"

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
import { Progress } from "@/components/ui/progress"
import { FileDropZone } from "@/components/candidates/file-drop-zone"
import { createClient } from "@/lib/supabase/client"
import {
  ResumeValidationError,
  uploadResumeWithProgress,
  validateResumeFile,
} from "@/lib/resume-upload"
import { notifyResumeUploaded } from "@/app/(app)/candidates/actions"
import { RESUME_ACCEPT } from "@/lib/constants"

type Method = "resume" | "csv"
type Status = "idle" | "uploading" | "notifying" | "error"

const COPY: Record<
  Method,
  { title: string; description: string; accept: string; hint: string }
> = {
  resume: {
    title: "Add a candidate",
    description:
      "Drop a resume and we'll pre-fill a draft for you to review before saving.",
    accept: RESUME_ACCEPT,
    hint: "PDF, DOC, or DOCX",
  },
  csv: {
    title: "Bulk upload candidates",
    description:
      "Drop a CSV and each row becomes a draft candidate for you to review.",
    accept: ".csv",
    hint: "CSV, one candidate per row",
  },
}

/**
 * Resume upload is the default/primary ingestion method; CSV and manual
 * entry are offered as alternatives below it. Resume upload is fully wired:
 * the file goes straight to the `resumes` Storage bucket from the browser
 * (with progress), then a Server Action hands the storage path to n8n for
 * parsing. CSV upload is still an honest stub — no CSV parsing exists yet.
 */
export function AddCandidateDialog() {
  const [open, setOpen] = React.useState(false)
  const [method, setMethod] = React.useState<Method>("resume")
  const [file, setFile] = React.useState<File | null>(null)
  const [status, setStatus] = React.useState<Status>("idle")
  const [progress, setProgress] = React.useState(0)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const abortRef = React.useRef<(() => void) | null>(null)

  const busy = status === "uploading" || status === "notifying"

  function resetState() {
    setMethod("resume")
    setFile(null)
    setStatus("idle")
    setProgress(0)
    setErrorMessage(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next && status === "uploading") {
      abortRef.current?.()
    }
    setOpen(next)
    if (!next) resetState()
  }

  async function handleResumeContinue() {
    if (!file) return
    setErrorMessage(null)

    try {
      validateResumeFile(file)
    } catch (err) {
      const message =
        err instanceof ResumeValidationError ? err.message : "Invalid file."
      setErrorMessage(message)
      toast.error(message)
      return
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      const message = "You must be signed in to upload a resume."
      setErrorMessage(message)
      toast.error(message)
      return
    }

    setStatus("uploading")
    setProgress(0)

    const { promise, abort } = uploadResumeWithProgress({
      file,
      userId: user.id,
      onProgress: setProgress,
    })
    abortRef.current = abort

    let storagePath: string
    try {
      const result = await promise
      storagePath = result.storagePath
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed."
      setStatus("error")
      setErrorMessage(message)
      toast.error(message)
      return
    } finally {
      abortRef.current = null
    }

    setStatus("notifying")
    const toastId = toast.loading("Resume is being parsed…")
    const notifyResult = await notifyResumeUploaded(storagePath, file.name)
    if (!notifyResult.ok) {
      setStatus("error")
      setErrorMessage(notifyResult.error)
      toast.error(notifyResult.error, { id: toastId })
      return
    }

    toast.success(
      notifyResult.candidateName
        ? `Resume parsed. ${notifyResult.candidateName} added as a candidate.`
        : "Resume parsed. Candidate added.",
      { id: toastId }
    )
    handleOpenChange(false)
  }

  const copy = COPY[method]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button>Add Candidate</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <FileDropZone
          accept={copy.accept}
          hint={copy.hint}
          file={file}
          onFileChange={(next) => {
            setFile(next)
            setStatus("idle")
            setErrorMessage(null)
          }}
        />

        {status === "uploading" && (
          <div className="space-y-1.5">
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground">
              Uploading… {progress}%
            </p>
          </div>
        )}
        {status === "notifying" && (
          <div className="space-y-1.5">
            <Progress value={null} />
            <p className="text-xs text-muted-foreground">
              Parsing resume…
            </p>
          </div>
        )}
        {status === "error" && errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}

        <Button
          disabled={!file || busy}
          onClick={
            method === "resume"
              ? handleResumeContinue
              : () => toast.info("Not wired up yet — parsing is coming soon.")
          }
        >
          {status === "uploading"
            ? "Uploading…"
            : status === "notifying"
              ? "Parsing…"
              : "Continue"}
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
              disabled={busy}
              onClick={() => {
                setFile(null)
                setMethod("csv")
              }}
            >
              <FileSpreadsheet className="size-4" />
              CSV upload
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setFile(null)
                setMethod("resume")
              }}
            >
              Resume upload
            </Button>
          )}
          <Link
            href="/candidates/new"
            className={buttonVariants({ variant: "outline" })}
            aria-disabled={busy}
            onClick={(e) => {
              if (busy) {
                e.preventDefault()
                return
              }
              handleOpenChange(false)
            }}
          >
            <ClipboardList className="size-4" />
            Manual form
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
