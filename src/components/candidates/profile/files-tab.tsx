"use client"

import { FileText, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { MOCK_FILES } from "@/lib/mock-files"

export function FilesTab({ candidateId }: { candidateId: string }) {
  const files = MOCK_FILES[candidateId] ?? []

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

      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <FileText className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {file.sizeKb} KB · Uploaded {file.uploadedAt} by{" "}
                  {file.uploadedBy}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
