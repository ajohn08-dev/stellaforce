"use client"

import * as React from "react"
import Link from "next/link"
import { Eye, ChevronDown, Bookmark } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { CandidateRow } from "@/lib/supabase/types"

/**
 * Shortlist + view-full-profile actions — shared by grid and list views.
 * Shortlist is presentational only for now — no persisted field/table yet,
 * so it resets on reload.
 */
export function CandidateActions({ candidate }: { candidate: CandidateRow }) {
  const [shortlisted, setShortlisted] = React.useState(false)

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant={shortlisted ? "secondary" : "outline"}
        size="sm"
        className="gap-1"
        onClick={() => setShortlisted((v) => !v)}
      >
        <Bookmark className={shortlisted ? "fill-current" : undefined} />
        {shortlisted ? "Shortlisted" : "Shortlist"}
        <ChevronDown className="size-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="View full profile"
        render={<Link href={`/candidates/${candidate.candidate_id}`} />}
      >
        <Eye />
      </Button>
    </div>
  )
}
