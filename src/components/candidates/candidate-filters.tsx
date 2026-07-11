"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { CANDIDATE_TIERS, titleCase } from "@/lib/constants"

const ALL = "all"

/** Structured filter bar for the candidates list; pushes state into the URL. */
export function CandidateFilters() {
  const router = useRouter()
  const params = useSearchParams()

  const [q, setQ] = React.useState(params.get("q") ?? "")
  const [skill, setSkill] = React.useState(params.get("skill") ?? "")
  const [location, setLocation] = React.useState(params.get("location") ?? "")
  const tier = params.get("tier") ?? ALL

  function apply(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v && v !== ALL) sp.set(k, v)
      else sp.delete(k)
    }
    router.push(`/candidates?${sp.toString()}`)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    apply({ q, skill, location })
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3"
    >
      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground">Name</label>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name…"
          className="w-44"
        />
      </div>

      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground">Tier</label>
        <Select value={tier} onValueChange={(v) => apply({ tier: v })}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All tiers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All tiers</SelectItem>
            {CANDIDATE_TIERS.map((t) => (
              <SelectItem key={t} value={t}>
                {titleCase(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground">Skill</label>
        <Input
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
          placeholder="e.g. React"
          className="w-40"
        />
      </div>

      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground">Location</label>
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Remote"
          className="w-40"
        />
      </div>

      <Button type="submit">Apply</Button>
    </form>
  )
}
