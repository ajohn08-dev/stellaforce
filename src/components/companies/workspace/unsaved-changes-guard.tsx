"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCompanyDraft } from "@/components/companies/company-draft-context"

/**
 * Stops unsaved edits from disappearing when you leave the company.
 *
 * The draft buffer is company-wide and lives only in memory, so navigating to
 * another page throws it away — silently, and with no way back. That's the one
 * place batching everything behind a single Publish turns from a convenience
 * into a trap.
 *
 * Two exits to cover, and they need different mechanisms:
 *
 *  - **Closing or reloading the tab** — `beforeunload`, which is all the browser
 *    permits (the confirmation wording is the browser's, not ours).
 *  - **Clicking a link inside the app** — the App Router has no navigation
 *    guard, so this intercepts anchor clicks during the capture phase and holds
 *    the destination until the recruiter chooses.
 *
 * Links *within* this company are deliberately not intercepted: moving between
 * sections is the normal way to work, and the whole point of the shared buffer
 * is that it survives that.
 */
export function UnsavedChangesGuard({ companyId }: { companyId: string }) {
  const router = useRouter()
  const draft = useCompanyDraft()
  const count = draft?.changes.length ?? 0
  const [pendingHref, setPendingHref] = React.useState<string | null>(null)

  const dirty = count > 0

  React.useEffect(() => {
    if (!dirty) return

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      // Required by older browsers; the message itself is ignored by all of them.
      e.returnValue = ""
    }

    function onClick(e: MouseEvent) {
      // Let the browser handle anything that isn't a plain left-click on a link.
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const anchor = (e.target as HTMLElement | null)?.closest?.("a")
      if (!anchor) return

      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#")) return
      if (anchor.target && anchor.target !== "_self") return

      // Staying inside this company — including every section link — is fine.
      if (href.startsWith(`/companies/${companyId}`)) return
      // External links open elsewhere and don't discard anything.
      if (!href.startsWith("/")) return

      e.preventDefault()
      e.stopPropagation()
      setPendingHref(href)
    }

    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [dirty, companyId])

  return (
    <Dialog open={pendingHref !== null} onOpenChange={() => setPendingHref(null)}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            You have {count} unpublished change{count === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Leaving this company discards them. Nothing here has reached an agent
            yet — publish first if you want to keep it.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setPendingHref(null)}>
            Stay and publish
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const href = pendingHref
              draft?.discardAll()
              setPendingHref(null)
              if (href) router.push(href)
            }}
          >
            Discard and leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
