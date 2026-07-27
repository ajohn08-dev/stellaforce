"use client"

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { createClient } from "@/lib/supabase/client"
import { uploadResumeWithProgress } from "@/lib/resume-upload"
import { notifyResumeUploaded } from "@/app/(app)/candidates/actions"
import { ResumeUploadTray } from "@/components/candidates/resume-upload-tray"

export type ResumeUploadStatus =
  | "queued"
  | "uploading"
  | "parsing"
  | "done"
  | "needs_review"
  | "error"

export interface ResumeUploadItem {
  id: string
  file: File
  filename: string
  status: ResumeUploadStatus
  progress: number
  error?: string
  /** Set once the file itself is safely in Storage, so a retry after a
   * parsing failure re-sends the existing upload instead of re-uploading. */
  storagePath?: string
}

type QueueContextValue = {
  enqueueFiles: (files: File[]) => void
}

const QueueContext = createContext<QueueContextValue | null>(null)

/**
 * Global resume-ingestion queue: files enqueued here (from the Add Candidate
 * dialog) are uploaded to Storage and handed to n8n ONE AT A TIME, tracked in
 * a persistent bottom-right tray that survives navigation and the dialog
 * closing — mirrors upload-manager UIs (Drive, etc.) rather than a toast.
 * Mounted once in `(app)/layout.tsx` so it outlives any single page.
 */
export function ResumeUploadQueueProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ResumeUploadItem[]>([])
  const [visible, setVisible] = useState(false)
  const itemsRef = useRef<ResumeUploadItem[]>([])
  const processingRef = useRef(false)
  const cancelRef = useRef(false)
  const abortRef = useRef<(() => void) | null>(null)

  const applyItems = useCallback(
    (updater: (prev: ResumeUploadItem[]) => ResumeUploadItem[]) => {
      itemsRef.current = updater(itemsRef.current)
      setItems(itemsRef.current)
    },
    []
  )

  const updateItem = useCallback(
    (id: string, patch: Partial<ResumeUploadItem>) => {
      applyItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
    },
    [applyItems]
  )

  const processItem = useCallback(async (item: ResumeUploadItem, userId: string) => {
    let storagePath = item.storagePath

    if (!storagePath) {
      updateItem(item.id, { status: "uploading", progress: 0, error: undefined })
      const { promise, abort } = uploadResumeWithProgress({
        file: item.file,
        userId,
        onProgress: (percent) => updateItem(item.id, { progress: percent }),
      })
      abortRef.current = abort
      try {
        const result = await promise
        storagePath = result.storagePath
      } catch (err) {
        updateItem(item.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed.",
        })
        abortRef.current = null
        return
      }
      abortRef.current = null
      if (cancelRef.current) return
      updateItem(item.id, { storagePath })
    }

    updateItem(item.id, { status: "parsing", error: undefined })
    const result = await notifyResumeUploaded(storagePath, item.filename)
    if (!result.ok) {
      updateItem(item.id, { status: "error", error: result.error })
      return
    }
    updateItem(item.id, {
      status: result.status === "needs_review" ? "needs_review" : "done",
    })
  }, [updateItem])

  const runQueue = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true
    cancelRef.current = false

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      applyItems((prev) =>
        prev.map((it) =>
          it.status === "queued"
            ? { ...it, status: "error", error: "You must be signed in to upload a resume." }
            : it
        )
      )
      processingRef.current = false
      return
    }

    while (!cancelRef.current) {
      const next = itemsRef.current.find((it) => it.status === "queued")
      if (!next) break
      await processItem(next, user.id)
    }
    processingRef.current = false
  }, [processItem, applyItems])

  const enqueueFiles = useCallback(
    (files: File[]) => {
      const newItems: ResumeUploadItem[] = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        filename: file.name,
        status: "queued",
        progress: 0,
      }))
      if (newItems.length === 0) return
      applyItems((prev) => [...prev, ...newItems])
      setVisible(true)
      void runQueue()
    },
    [runQueue, applyItems]
  )

  const retryItem = useCallback(
    (id: string) => {
      applyItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, status: "queued", error: undefined } : it
        )
      )
      void runQueue()
    },
    [runQueue, applyItems]
  )

  const closeTray = useCallback(() => {
    cancelRef.current = true
    abortRef.current?.()
    setVisible(false)
    applyItems(() => [])
  }, [applyItems])

  return (
    <QueueContext.Provider value={{ enqueueFiles }}>
      {children}
      <ResumeUploadTray
        items={items}
        visible={visible}
        onRetry={retryItem}
        onClose={closeTray}
      />
    </QueueContext.Provider>
  )
}

/** Call from the Add Candidate dialog to hand off files for sequential upload. */
export function useResumeUploadQueue() {
  const ctx = useContext(QueueContext)
  if (!ctx) {
    throw new Error("useResumeUploadQueue must be used within a ResumeUploadQueueProvider")
  }
  return ctx
}
