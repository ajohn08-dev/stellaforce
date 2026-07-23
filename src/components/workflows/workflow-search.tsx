"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Input } from "@/components/ui/input"

export function WorkflowSearch() {
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = React.useState(params.get("q") ?? "")

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const sp = new URLSearchParams(params.toString())
    if (q) sp.set("q", q)
    else sp.delete("q")
    router.push(`/workflows?${sp.toString()}`)
  }

  return (
    <form onSubmit={onSubmit}>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, client, or department…"
        className="w-64 bg-white"
      />
    </form>
  )
}
