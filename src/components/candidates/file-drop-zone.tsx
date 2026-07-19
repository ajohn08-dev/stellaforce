"use client"

import * as React from "react"
import { UploadCloud, FileText, X } from "lucide-react"

import { cn } from "@/lib/utils"

/** Drag-and-drop file picker. Selecting a file is real; what happens with it is up to the caller. */
export function FileDropZone({
  accept,
  hint,
  file,
  onFileChange,
}: {
  accept: string
  hint: string
  file: File | null
  onFileChange: (file: File | null) => void
}) {
  const [dragActive, setDragActive] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) onFileChange(dropped)
  }

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border p-4">
        <FileText className="size-8 shrink-0 text-brand-purple-600" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {(file.size / 1024).toFixed(0)} KB
          </p>
        </div>
        <button
          type="button"
          aria-label="Remove file"
          onClick={() => onFileChange(null)}
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
        dragActive
          ? "border-primary bg-accent"
          : "border-border hover:border-muted-foreground/50"
      )}
    >
      <UploadCloud className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">
        Drag and drop, or{" "}
        <span className="text-primary underline underline-offset-2">
          browse
        </span>
      </p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
    </label>
  )
}
