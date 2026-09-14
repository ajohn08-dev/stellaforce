"use client"

import * as React from "react"
import Link from "next/link"
import { Eye, ExternalLink, ChevronDown, Bookmark } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { CandidateRow } from "@/lib/supabase/types"

/**
 * Shortlist + preview/full-view actions — shared by grid and list views, and by
 * Advanced Search results.
 *
 * Shortlist is presentational only for now — no persisted field/table yet, so
 * it resets on reload.
 *
 * Takes only `candidate_id` (all it has ever read) rather than a whole
 * `CandidateRow`, so a caller holding a narrow projection can reuse it without
 * being forced to fetch — and send to the browser — columns it doesn't render.
 */
export function CandidateActions({
  candidate,
}: {
  candidate: Pick<CandidateRow, "candidate_id">
}) {
  const [shortlisted, setShortlisted] = React.useState(false)
  const profileHref = `/candidates/${candidate.candidate_id}`

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

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Preview"
                render={<Link href={profileHref} />}
              >
                <Eye />
              </Button>
            }
          />
          <TooltipContent>Preview</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Full view"
                render={
                  <a
                    href={profileHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <ExternalLink />
              </Button>
            }
          />
          <TooltipContent>Full view</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
