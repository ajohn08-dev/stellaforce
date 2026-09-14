"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { CandidateAvatar } from "@/components/candidate-avatar"
import { CandidateActions } from "@/components/candidates/candidate-actions"
import {
  countryLabel,
  roleFamilyLabel,
  seniorityLabel,
  type CandidateSearchFilters,
  type CandidateSearchPage,
  type CandidateSearchResult,
} from "@/lib/candidate-search"
import { cn } from "@/lib/utils"

/**
 * Advanced Search results.
 *
 * Visually the candidates table — same primitives, same pinned first and last
 * columns, same header treatment, same footer — but bound to
 * `CandidateSearchResult` rather than to a candidate row, and paginated by the
 * server rather than by TanStack.
 *
 * Two deliberate differences from `CandidatesTable`, both forced by the data
 * contract rather than by design taste:
 *
 *   - **No Phone column.** Phone numbers are explicitly out of scope for what
 *     this screen sends to a browser, and a column can't render a field the
 *     server never selected.
 *   - **No Tier column.** `candidate_tier` isn't in the contract either.
 *
 * Sharing `CandidatesTable` instead would have meant feeding it `select("*")` —
 * phone, resume path, source metadata and the placeholder embedding vector
 * included — which is the thing this screen is not allowed to do.
 *
 * Pagination is driven through the URL so it survives a reload and a shared
 * link, and so the page stays a Server Component. Sorting is fixed at
 * `full_name ASC` server-side; the header is a plain label rather than a
 * control, because a clickable header that doesn't re-sort is worse than none.
 */

const LEFT_PINNED_WIDTHS = { select: 40, name: 220 }

/**
 * "Role: Account Executive, Channel / Partner Sales · Seniority: Senior · …"
 *
 * Built from the filters the server actually queried, not from the URL or the
 * rail's unapplied state — so the line can only ever describe the result set
 * beneath it. Filters that were not supplied are absent; nothing is invented to
 * pad the list.
 *
 * A role slug with no label is a role that no longer exists or was retired; it
 * is shown as its slug rather than dropped, because it is still narrowing the
 * search and silently omitting it would misdescribe the results.
 */
function appliedFilterSummary(
  filters: CandidateSearchFilters,
  roleLabels: Record<string, string>
): Array<{ label: string; value: string }> {
  const parts: Array<{ label: string; value: string }> = []

  if (filters.roleSlugs.length > 0) {
    parts.push({
      label: "Role",
      value: filters.roleSlugs.map((slug) => roleLabels[slug] ?? slug).join(", "),
    })
  }
  if (filters.roleFamilies.length > 0) {
    parts.push({
      label: "Role family",
      value: filters.roleFamilies.map(roleFamilyLabel).join(", "),
    })
  }
  if (filters.seniorities.length > 0) {
    parts.push({
      label: "Seniority",
      value: filters.seniorities.map(seniorityLabel).join(", "),
    })
  }
  if (filters.countries.length > 0) {
    parts.push({ label: "Country", value: filters.countries.map(countryLabel).join(", ") })
  }
  if (filters.title) parts.push({ label: "Title text", value: filters.title })
  if (filters.name) parts.push({ label: "Name", value: filters.name })
  if (filters.location) parts.push({ label: "City", value: filters.location })
  if (filters.skillTerms.length > 0) {
    parts.push({ label: "Skills", value: filters.skillTerms.join(", ") })
  }

  const { minYears: lo, maxYears: hi } = filters
  if (lo !== undefined && hi !== undefined) {
    parts.push({ label: "Experience", value: `${lo}–${hi} years` })
  } else if (lo !== undefined) {
    parts.push({ label: "Experience", value: `${lo}+ years` })
  } else if (hi !== undefined) {
    parts.push({ label: "Experience", value: `up to ${hi} years` })
  }

  return parts
}

export function AdvancedSearchResults({
  page,
  filters,
  roleLabels = {},
  unsupportedNotice = null,
}: {
  page: CandidateSearchPage
  /** What the server actually queried — the summary describes the result set. */
  filters?: CandidateSearchFilters
  /** Canonical role slug → label, resolved on the server. */
  roleLabels?: Record<string, string>
  /** What the AI parse asked for and could not apply. */
  unsupportedNotice?: string | null
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [selected, setSelected] = React.useState<Record<string, boolean>>({})

  const { results, totalCount, page: current, totalPages } = page
  const allOnPageSelected =
    results.length > 0 && results.every((r) => selected[r.candidateId])

  function goToPage(next: number) {
    const sp = new URLSearchParams(params.toString())
    if (next <= 1) sp.delete("page")
    else sp.set("page", String(next))
    const qs = sp.toString()
    router.push(qs ? `/candidates/search?${qs}` : "/candidates/search", {
      scroll: false,
    })
  }

  const summary = filters ? appliedFilterSummary(filters, roleLabels) : []
  const classifiedOnly =
    !!filters &&
    (filters.roleSlugs.length > 0 || filters.roleFamilies.length > 0)

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-white">
      {/* The applied-filter summary. One muted line, inside the existing
          results card — not a panel: it says what the table below is, which is
          otherwise only legible by reading the rail. */}
      {/* A requirement that was asked for and not applied.
          Amber and above the table, not a grey line in the rail: the whole
          failure mode this prevents is a recruiter reading a result set as an
          answer to the question they asked, when part of it was dropped. This
          is the one case where results are honestly not what was requested, so
          it outranks the filter summary and sits where the eye already is. */}
      {unsupportedNotice && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2">
          <p className="text-xs text-amber-900">
            <span className="font-medium">Not applied:</span> {unsupportedNotice}.
            These results aren&apos;t filtered by it.
          </p>
        </div>
      )}

      {summary.length > 0 && (
        <div className="shrink-0 space-y-1 border-b border-border px-4 py-2">
          <p className="text-xs text-muted-foreground">
            {summary.map((part, i) => (
              <React.Fragment key={part.label}>
                {i > 0 && <span className="px-1.5 text-border">·</span>}
                <span>
                  {part.label}: <span className="text-foreground">{part.value}</span>
                </span>
              </React.Fragment>
            ))}
          </p>
          {/* Only when a normalized filter is doing the narrowing. A role
              filter can only match a candidate whose title was classified, and
              a recruiter reading a short result set has no way to know that
              from the count alone. */}
          {classifiedOnly && (
            <p className="text-xs text-muted-foreground">
              Role filters use classified current titles. Use Title text contains
              to include title variants or unclassified candidates.
            </p>
          )}
        </div>
      )}

      <Table
        className="table-fixed"
        containerClassName="min-h-0 flex-1 overflow-y-auto scrollbar-light"
      >
        {/* z-30 for the same reason as the candidates table: pinned body cells
            are themselves sticky at z-20 and form their own stacking contexts,
            so the header has to outrank them or columns bleed through it. */}
        <TableHeader className="sticky top-0 z-30 bg-muted">
          <TableRow>
            <TableHead
              style={{ width: LEFT_PINNED_WIDTHS.select, position: "sticky", left: 0, top: 0, zIndex: 30 }}
              className="bg-muted"
            >
              <Checkbox
                aria-label="Select all candidates on this page"
                checked={allOnPageSelected}
                indeterminate={
                  !allOnPageSelected && results.some((r) => selected[r.candidateId])
                }
                onCheckedChange={(checked) =>
                  setSelected((current) => {
                    const next = { ...current }
                    for (const r of results) {
                      if (checked) next[r.candidateId] = true
                      else delete next[r.candidateId]
                    }
                    return next
                  })
                }
              />
            </TableHead>
            <TableHead
              style={{
                width: LEFT_PINNED_WIDTHS.name,
                position: "sticky",
                left: LEFT_PINNED_WIDTHS.select,
                top: 0,
                zIndex: 30,
              }}
              className="bg-muted shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
            >
              Name
            </TableHead>
            <TableHead style={{ width: 180 }}>Title</TableHead>
            <TableHead style={{ width: 170 }}>Company</TableHead>
            <TableHead style={{ width: 260 }}>Profile</TableHead>
            <TableHead style={{ width: 220 }}>Email</TableHead>
            <TableHead style={{ width: 70 }}>Yrs</TableHead>
            <TableHead style={{ width: 160 }}>Location</TableHead>
            <TableHead
              style={{ width: 300, position: "sticky", right: 0, top: 0, zIndex: 30 }}
              className="bg-muted shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.08)]"
            />
          </TableRow>
        </TableHeader>

        <TableBody>
          {results.length ? (
            results.map((row) => (
              <Row
                key={row.candidateId}
                row={row}
                selected={!!selected[row.candidateId]}
                onSelectedChange={(checked) =>
                  setSelected((current) => {
                    const next = { ...current }
                    if (checked) next[row.candidateId] = true
                    else delete next[row.candidateId]
                    return next
                  })
                }
              />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                No candidates match these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border px-4 py-2">
        <span className="text-sm text-muted-foreground">
          {totalCount === 0
            ? "No candidates"
            : `${totalCount.toLocaleString()} candidate${totalCount === 1 ? "" : "s"}`}
        </span>
        <div className="flex items-center gap-4">
          {totalPages > 0 && (
            <span className="text-sm text-muted-foreground">
              Page {current} of {totalPages}
            </span>
          )}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              disabled={current <= 1}
              onClick={() => goToPage(current - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              disabled={current >= totalPages}
              onClick={() => goToPage(current + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({
  row,
  selected,
  onSelectedChange,
}: {
  row: CandidateSearchResult
  selected: boolean
  onSelectedChange: (checked: boolean) => void
}) {
  const router = useRouter()
  const href = `/candidates/${row.candidateId}`
  const location = [row.locationCity, row.locationState].filter(Boolean).join(", ")

  return (
    <TableRow
      className="group cursor-pointer hover:bg-muted"
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (target.closest("a, button, [role='checkbox'], input")) return
        router.push(href)
      }}
    >
      <TableCell
        style={{ width: LEFT_PINNED_WIDTHS.select, position: "sticky", left: 0, zIndex: 20 }}
        className="bg-white group-hover:bg-muted"
      >
        <Checkbox
          aria-label={`Select ${row.fullName}`}
          checked={selected}
          onCheckedChange={(checked) => onSelectedChange(!!checked)}
        />
      </TableCell>
      <TableCell
        style={{
          width: LEFT_PINNED_WIDTHS.name,
          position: "sticky",
          left: LEFT_PINNED_WIDTHS.select,
          zIndex: 20,
        }}
        className={cn(
          "bg-white group-hover:bg-muted",
          "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
        )}
      >
        <Link
          href={href}
          className="flex items-center gap-2.5 truncate font-medium hover:text-brand-purple-600"
        >
          <CandidateAvatar
            name={row.fullName}
            avatarUrl={row.avatarUrl}
            className="size-7 shrink-0"
          />
          <span className="truncate">{row.fullName}</span>
        </Link>
      </TableCell>

      <Text value={row.currentTitle} />
      <Text value={row.currentCompany} />

      <TableCell>
        {row.linkedinUrl ? (
          <ExternalValue href={row.linkedinUrl}>{row.linkedinUrl}</ExternalValue>
        ) : (
          <Dash />
        )}
      </TableCell>
      <TableCell>
        {row.email ? (
          <ExternalValue href={`mailto:${row.email}`}>{row.email}</ExternalValue>
        ) : (
          <Dash />
        )}
      </TableCell>
      <TableCell>{row.yearsExperience ?? <Dash />}</TableCell>
      <TableCell>
        <span className="block truncate">{location || <Dash />}</span>
      </TableCell>

      <TableCell
        style={{ width: 300, position: "sticky", right: 0, zIndex: 20 }}
        className="bg-white group-hover:bg-muted shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.08)]"
      >
        <div className="flex items-center justify-end gap-3">
          <CandidateActions candidate={{ candidate_id: row.candidateId }} />
        </div>
      </TableCell>
    </TableRow>
  )
}

/** Missing values are an em dash — never a placeholder, never a repeated stand-in. */
function Dash() {
  return <>—</>
}

function Text({ value }: { value: string | null }) {
  return (
    <TableCell>
      <span className="block truncate">{value || <Dash />}</span>
    </TableCell>
  )
}

function ExternalValue({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="block truncate hover:text-brand-purple-600"
    >
      {children}
    </a>
  )
}
