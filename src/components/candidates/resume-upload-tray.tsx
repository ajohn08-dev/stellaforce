"use client"

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  RotateCw,
  X,
} from "lucide-react"

import { Progress } from "@/components/ui/progress"
import type { ResumeUploadItem } from "@/lib/resume-upload-queue"

const STATUS_LABEL: Record<ResumeUploadItem["status"], string> = {
  queued: "Waiting to upload",
  uploading: "Uploading",
  parsing: "Parsing",
  done: "Uploaded",
  needs_review: "Uploaded — needs review",
  error: "Failed to upload",
}

/** Persistent bottom-right upload tray. Presentational — the queue provider owns all state. */
export function ResumeUploadTray({
  items,
  visible,
  onRetry,
  onClose,
}: {
  items: ResumeUploadItem[]
  visible: boolean
  onRetry: (id: string) => void
  onClose: () => void
}) {
  if (!visible || items.length === 0) return null

  const activeCount = items.filter(
    (it) => it.status === "queued" || it.status === "uploading" || it.status === "parsing"
  ).length
  const errorCount = items.filter((it) => it.status === "error").length
  const isActive = activeCount > 0
  const noun = items.length === 1 ? "document" : "documents"

  const title = isActive
    ? `Uploading ${items.length} ${noun}`
    : errorCount > 0
      ? `${errorCount} of ${items.length} failed`
      : `${items.length} ${noun} uploaded`

  return (
    <div className="fixed right-4 bottom-4 z-50 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <p className="text-sm font-medium">{title}</p>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      {isActive && <Progress value={null} className="rounded-none" />}
      <ul className="max-h-72 divide-y divide-border overflow-y-auto">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2.5 px-4 py-2.5 text-sm">
            <div className="mt-0.5 shrink-0">
              {(item.status === "queued" || item.status === "uploading") && (
                <Circle className="size-4 text-muted-foreground" />
              )}
              {item.status === "parsing" && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              {item.status === "done" && (
                <CheckCircle2 className="size-4 text-emerald-600" />
              )}
              {item.status === "needs_review" && (
                <AlertTriangle className="size-4 text-amber-500" />
              )}
              {item.status === "error" && (
                <AlertCircle className="size-4 text-destructive" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate">
                <span className="text-muted-foreground">
                  {STATUS_LABEL[item.status]}
                  {item.status === "uploading" ? `… ${item.progress}%` : ""}{" "}
                </span>
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  {item.filename}
                </code>
              </p>
              {item.status === "uploading" && (
                <Progress value={item.progress} className="mt-1 h-1" />
              )}
              {item.status === "error" && item.error && (
                <p className="mt-0.5 truncate text-xs text-destructive">{item.error}</p>
              )}
            </div>

            {item.status === "error" && (
              <button
                type="button"
                aria-label={`Retry ${item.filename}`}
                onClick={() => onRetry(item.id)}
                className="mt-0.5 shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <RotateCw className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
