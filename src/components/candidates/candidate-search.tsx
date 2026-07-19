"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Input } from "@/components/ui/input"

export function CandidateSearch() {
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = React.useState(params.get("q") ?? "")

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const sp = new URLSearchParams(params.toString())
    if (q) sp.set("q", q)
    else sp.delete("q")
    router.push(`/candidates?${sp.toString()}`)
  }

  return (
    <form onSubmit={onSubmit}>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name…"
        className="w-56 bg-white"
      />
    </form>
  )
}
