"use client"

import * as React from "react"
import { ChevronLeft, Filter } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const RECRUITER_OPTIONS = ["My Reqs", "Priya Desai", "Sam Okafor"]
const CLIENT_OPTIONS = ["Zenarate", "Naehas", "Acme"]

/**
 * UI-only placeholder — no data pipeline behind these fields yet, so
 * selections are local state and don't filter anything on the page. Unlike
 * the client-admin home page's Filter button (scoped to one client
 * already), an internal admin oversees multiple recruiters and clients, so
 * this filters by recruiter and by client.
 */
function CheckableOptionsList({
  options,
  selected,
  onChange,
}: {
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <>
      {options.map((option) => (
        <DropdownMenuCheckboxItem
          key={option}
          checked={selected.includes(option)}
          onCheckedChange={(checked) =>
            onChange(checked ? [...selected, option] : selected.filter((o) => o !== option))
          }
        >
          {option}
        </DropdownMenuCheckboxItem>
      ))}
    </>
  )
}

export function InternalAdminFilterButton() {
  const [recruiters, setRecruiters] = React.useState<string[]>([])
  const [clients, setClients] = React.useState<string[]>([])

  return (
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
            <span className="flex-1">Recruiter</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <CheckableOptionsList
              options={RECRUITER_OPTIONS}
              selected={recruiters}
              onChange={setRecruiters}
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ChevronLeft className="size-4" />
            <span className="flex-1">Client</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <CheckableOptionsList options={CLIENT_OPTIONS} selected={clients} onChange={setClients} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
