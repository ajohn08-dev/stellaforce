"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, Filter, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Automation states. Local to this component rather than in `src/lib/` — there
 * is no `automation_rules` UI yet, so this is a plausible vocabulary for the
 * toolbar to drive, not a source of truth. It moves to `src/lib/` the moment
 * something real reads it.
 */
const STATUS_OPTIONS = ["active", "paused", "draft"] as const

function parseStatuses(param: string | null): string[] {
  if (param === null) return [...STATUS_OPTIONS]
  if (!param) return []
  return param.split(",").filter((s) => STATUS_OPTIONS.includes(s as (typeof STATUS_OPTIONS)[number]))
}

/**
 * Search + Filter + Add, matching the `/jobs` toolbar strip.
 *
 * The controls are real — both write to the URL, and the page reads them back —
 * but nothing is filtered yet, because there are no automations to filter. See
 * the note on the page itself.
 */
export function AutomationToolbar() {
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = React.useState(params.get("q") ?? "")
  const statuses = parseStatuses(params.get("statuses"))

  function push(mutate: (sp: URLSearchParams) => void) {
    const sp = new URLSearchParams(params.toString())
    mutate(sp)
    router.push(`/automations?${sp.toString()}`)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    push((sp) => (q ? sp.set("q", q) : sp.delete("q")))
  }

  function setStatuses(next: string[]) {
    push((sp) => sp.set("statuses", next.join(",")))
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <form onSubmit={onSubmit}>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search automations…"
            className="w-56 bg-white"
          />
        </form>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="outline" className="gap-1.5">
                <Filter className="size-4" />
                Filter
              </Button>
            }
          />
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ChevronLeft className="size-4" />
                <span className="flex-1">Status</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => setStatuses([...STATUS_OPTIONS])}>
                  All
                </DropdownMenuItem>
                {STATUS_OPTIONS.map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s}
                    checked={statuses.includes(s)}
                    onCheckedChange={(checked) =>
                      setStatuses(
                        checked ? [...statuses, s] : statuses.filter((x) => x !== s)
                      )
                    }
                    className="capitalize"
                  >
                    {s}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuItem onClick={() => setStatuses([])}>None</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Button
        className="gap-1.5"
        onClick={() => toast.info("Not wired up yet — the automation builder is coming soon.")}
      >
        <Plus className="size-4" />
        Add Automation
      </Button>
    </div>
  )
}
