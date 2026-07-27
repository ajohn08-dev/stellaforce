"use client"

import { FileText, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { CandidateResumeFile } from "@/lib/data"

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ""
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function formatUploadedAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

// The resume-ingestion pipeline doesn't currently populate resumes.mime_type
// (n8n's payload has no file-metadata field for it), so fall back to the
// filename extension rather than always landing in the "no preview" branch
// for genuine PDFs.
function isPdf(resume: CandidateResumeFile): boolean {
  return resume.mimeType === "application/pdf" || /\.pdf$/i.test(resume.filename)
}

export function FilesTab({ resume }: { resume: CandidateResumeFile | null }) {
  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() =>
          toast.info("Not wired up yet — file upload is coming soon.")
        }
      >
        <Upload className="size-4" />
        Upload file
      </Button>

      {!resume ? (
        <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
      ) : (
        <Dialog>
          <DialogTrigger
            render={
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-muted/50"
              >
                <FileText className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{resume.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(resume.fileSize)}
                    {resume.fileSize ? " · " : ""}
                    Uploaded {formatUploadedAt(resume.uploadedAt)}
                  </p>
                </div>
              </button>
            }
          />
          <DialogContent className="flex h-[85vh] flex-col sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{resume.filename}</DialogTitle>
            </DialogHeader>
            {isPdf(resume) ? (
              <iframe
                src={resume.signedUrl}
                title={resume.filename}
                className="min-h-0 w-full flex-1 rounded-md border border-border"
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm text-muted-foreground">
                  Preview isn&apos;t available for this file type.
                </p>
                <a
                  href={resume.signedUrl}
                  download={resume.filename}
                  className="text-sm font-medium text-brand-purple-600 hover:text-brand-purple-700"
                >
                  Download {resume.filename}
                </a>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
