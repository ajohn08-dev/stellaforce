"use client"

import * as React from "react"
import { UploadCloud, FileText, X } from "lucide-react"

import { cn } from "@/lib/utils"

type FileDropZoneProps =
  | {
      multiple?: false
      accept: string
      hint: string
      file: File | null
      onFileChange: (file: File | null) => void
    }
  | {
      multiple: true
      accept: string
      hint: string
      disabled?: boolean
      onFilesSelected: (files: File[]) => void
    }

/** Drag-and-drop file picker. Selecting file(s) is real; what happens with them is up to the caller. */
export function FileDropZone(props: FileDropZoneProps) {
  const { accept, hint } = props
  const [dragActive, setDragActive] = React.useState(false)
  const disabled = props.multiple ? !!props.disabled : false

  function handleFiles(list: FileList | null) {
    if (!list || list.length === 0 || disabled) return
    if (props.multiple) {
      props.onFilesSelected(Array.from(list))
    } else {
      props.onFileChange(list[0])
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    handleFiles(e.dataTransfer.files)
  }

  if (!props.multiple && props.file) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border p-4">
        <FileText className="size-8 shrink-0 text-brand-purple-600" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{props.file.name}</p>
          <p className="text-xs text-muted-foreground">
            {(props.file.size / 1024).toFixed(0)} KB
          </p>
        </div>
        <button
          type="button"
          aria-label="Remove file"
          onClick={() => props.onFileChange(null)}
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
        if (!disabled) setDragActive(true)
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:border-muted-foreground/50",
        dragActive && !disabled ? "border-primary bg-accent" : "border-border"
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
        type="file"
        accept={accept}
        multiple={props.multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ""
        }}
      />
    </label>
  )
}
