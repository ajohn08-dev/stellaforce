"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { LayoutGrid, List } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * List / card switch. **List is the default** — no param means table, `?view=grid`
 * means cards. Mirrors `JobViewToggle`, including keeping the default state out
 * of the URL so a plain `/companies` link lands somewhere predictable.
 */
export function CompanyViewToggle() {
  const router = useRouter()
  const params = useSearchParams()
  const view = params.get("view") === "grid" ? "grid" : "list"

  function setView(next: "list" | "grid") {
    const sp = new URLSearchParams(params.toString())
    if (next === "grid") sp.set("view", "grid")
    else sp.delete("view")
    const qs = sp.toString()
    router.push(qs ? `/companies?${qs}` : "/companies")
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
        aria-label="Card view"
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
