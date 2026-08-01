"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export type TabSaveResult = { ok: true } | { ok: false; error: string }
type SaveHandler = () => Promise<TabSaveResult>

type WorkflowEditContextValue = {
  setTabDirty: (tabId: string, dirty: boolean) => void
  registerSaveHandler: (tabId: string, handler: SaveHandler) => void
  isDirty: boolean
  saving: boolean
  saveAll: () => Promise<TabSaveResult>
}

const WorkflowEditContext = React.createContext<WorkflowEditContextValue | null>(null)

export function useWorkflowEdit() {
  const ctx = React.useContext(WorkflowEditContext)
  if (!ctx) throw new Error("useWorkflowEdit must be used within a WorkflowEditProvider")
  return ctx
}

/** Wires a tab's local dirty state + save function into the shared workflow-edit context. */
export function useWorkflowEditTab(tabId: string, isDirty: boolean, save: SaveHandler) {
  const { setTabDirty, registerSaveHandler } = useWorkflowEdit()

  React.useEffect(() => {
    setTabDirty(tabId, isDirty)
  }, [tabId, isDirty, setTabDirty])

  const saveRef = React.useRef(save)
  React.useEffect(() => {
    saveRef.current = save
  })
  React.useEffect(() => {
    registerSaveHandler(tabId, () => saveRef.current())
  }, [tabId, registerSaveHandler])
}

/**
 * Tracks unsaved edits across the workflow-detail tabs and gates navigation
 * away from the page on them — nothing here persists until Save runs. Two
 * navigation paths are covered: in-app link clicks (sidebar, breadcrumb,
 * workflow cards, etc.) via a document-level capturing click listener — this
 * works regardless of where in the tree this provider is mounted relative to
 * those links, so none of them need to know about this at all — and actual
 * browser navigation (refresh/close/typed URL) via `beforeunload`, which can
 * only show the browser's own native prompt, not this component's dialog.
 * The browser back/forward buttons for client-side route changes aren't
 * covered — Next.js's App Router has no hook to intercept those today.
 */
export function WorkflowEditProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [dirtyMap, setDirtyMap] = React.useState<Record<string, boolean>>({})
  const saveHandlers = React.useRef<Map<string, SaveHandler>>(new Map())
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [pendingHref, setPendingHref] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const isDirty = Object.values(dirtyMap).some(Boolean)

  const setTabDirty = React.useCallback((tabId: string, dirty: boolean) => {
    setDirtyMap((prev) => (!!prev[tabId] === dirty ? prev : { ...prev, [tabId]: dirty }))
  }, [])

  const registerSaveHandler = React.useCallback((tabId: string, handler: SaveHandler) => {
    saveHandlers.current.set(tabId, handler)
  }, [])

  const saveAll = React.useCallback(async (): Promise<TabSaveResult> => {
    const dirtyIds = Object.entries(dirtyMap)
      .filter(([, dirty]) => dirty)
      .map(([id]) => id)
    if (dirtyIds.length === 0) return { ok: true }

    setSaving(true)
    try {
      const results = await Promise.all(
        dirtyIds.map((id) => saveHandlers.current.get(id)?.() ?? Promise.resolve({ ok: true } as const))
      )
      return results.find((r): r is { ok: false; error: string } => !r.ok) ?? { ok: true }
    } finally {
      setSaving(false)
    }
  }, [dirtyMap])

  const requestNavigate = React.useCallback(
    (href: string) => {
      if (!isDirty) {
        router.push(href)
        return
      }
      setPendingHref(href)
      setConfirmOpen(true)
    },
    [isDirty, router]
  )

  React.useEffect(() => {
    if (!isDirty) return
    function handleClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return
      const anchor = (e.target as HTMLElement).closest?.("a[href]") as HTMLAnchorElement | null
      if (!anchor || (anchor.target && anchor.target !== "_self")) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      const href = url.pathname + url.search + url.hash
      if (href === window.location.pathname + window.location.search + window.location.hash) return
      e.preventDefault()
      requestNavigate(href)
    }
    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  }, [isDirty, requestNavigate])

  React.useEffect(() => {
    if (!isDirty) return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

  async function handleSaveAndLeave() {
    const res = await saveAll()
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setConfirmOpen(false)
    if (pendingHref) router.push(pendingHref)
  }

  function handleLeaveWithoutSaving() {
    setConfirmOpen(false)
    if (pendingHref) router.push(pendingHref)
  }

  return (
    <WorkflowEditContext.Provider value={{ setTabDirty, registerSaveHandler, isDirty, saving, saveAll }}>
      {children}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes on this workflow. Save them before leaving, or
              continue and they&apos;ll be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleLeaveWithoutSaving} disabled={saving}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveAndLeave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkflowEditContext.Provider>
  )
}
