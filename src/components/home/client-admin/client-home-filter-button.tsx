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

const DEPARTMENT_OPTIONS = ["Engineering", "Design", "Product", "Data", "Finance", "Marketing"]
const PRIORITY_OPTIONS = ["Priority", "Standard"]

/**
 * UI-only placeholder — no data pipeline behind these fields yet, so
 * selections are local state and don't filter anything on the page. A
 * client admin belongs to one client already, so — unlike the recruiter
 * home page's Filter button — this filters by department/team and req
 * priority instead of by client.
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

export function ClientHomeFilterButton() {
  const [departments, setDepartments] = React.useState<string[]>([])
  const [priorities, setPriorities] = React.useState<string[]>([])

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
            <span className="flex-1">Department</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <CheckableOptionsList
              options={DEPARTMENT_OPTIONS}
              selected={departments}
              onChange={setDepartments}
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ChevronLeft className="size-4" />
            <span className="flex-1">Priority</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <CheckableOptionsList
              options={PRIORITY_OPTIONS}
              selected={priorities}
              onChange={setPriorities}
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
