"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { List, LayoutGrid } from "lucide-react"

import { cn } from "@/lib/utils"

export function WorkflowViewToggle() {
  const router = useRouter()
  const params = useSearchParams()
  const view = params.get("view") === "grid" ? "grid" : "list"

  function setView(next: "list" | "grid") {
    const sp = new URLSearchParams(params.toString())
    if (next === "grid") sp.set("view", "grid")
    else sp.delete("view")
    router.push(`/workflows?${sp.toString()}`)
  }

  return (
    <div className="inline-flex items-center rounded-lg border border-border p-0.5">
      <button
        type="button"
        aria-label="List view"
        aria-pressed={view === "list"}
        onClick={() => setView("list")}
        className={cn(
          "flex size-7 items-center justify-center rounded-md transition-colors",
          view === "list"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <List className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Grid view"
        aria-pressed={view === "grid"}
        onClick={() => setView("grid")}
        className={cn(
          "flex size-7 items-center justify-center rounded-md transition-colors",
          view === "grid"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <LayoutGrid className="size-4" />
      </button>
    </div>
  )
}
