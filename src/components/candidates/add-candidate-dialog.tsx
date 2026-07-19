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
import { FileDropZone } from "@/components/candidates/file-drop-zone"

type Method = "resume" | "csv"

const COPY: Record<
  Method,
  { title: string; description: string; accept: string; hint: string }
> = {
  resume: {
    title: "Add a candidate",
    description:
      "Drop a resume and we'll pre-fill a draft for you to review before saving.",
    accept: ".pdf,.doc,.docx",
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
 * entry are offered as alternatives below it. Selecting a file is fully
 * functional — parsing it is not wired up yet (no PDF/DOCX text extraction
 * or CSV parsing exists server-side), so "Continue" is an honest stub.
 */
export function AddCandidateDialog() {
  const [open, setOpen] = React.useState(false)
  const [method, setMethod] = React.useState<Method>("resume")
  const [file, setFile] = React.useState<File | null>(null)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setMethod("resume")
      setFile(null)
    }
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
          onFileChange={setFile}
        />

        <Button
          disabled={!file}
          onClick={() =>
            toast.info("Not wired up yet — parsing is coming soon.")
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
