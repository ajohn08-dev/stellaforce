"use client"

import * as React from "react"
import Link from "next/link"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CompanyLogo } from "@/components/companies/company-logo"
import { ReadinessPill } from "@/components/companies/shared/readiness-pill"
import type { CompanyListItem } from "@/components/companies/company-list-item"
import type { ReadinessStatus } from "@/lib/company-readiness"

/**
 * The default company view. A table rather than cards because the job here is
 * comparison — which accounts are blocked, which are stalest, which carry the
 * most open jobs — and comparison wants aligned columns, not a grid of tiles.
 *
 * Sorted by readiness first on load, so whatever needs attention is on top
 * without anyone touching a control.
 */

function sortHeader(label: string) {
  return function SortableHeader({
    column,
  }: {
    column: {
      toggleSorting: (d?: boolean) => void
      getIsSorted: () => false | "asc" | "desc"
    }
  }) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-7"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {label}
        <ArrowUpDown className="ml-1 opacity-50" />
      </Button>
    )
  }
}

/** Worst-first, so ascending sort surfaces problems. */
const READINESS_RANK: Record<ReadinessStatus, number> = {
  blocked: 0,
  review_required: 1,
  ready_with_caveats: 2,
  ready: 3,
}

const columns: ColumnDef<CompanyListItem>[] = [
  {
    accessorKey: "name",
    header: sortHeader("Company"),
    // Industry and headquarters were their own columns, along with funding
    // stage. Three columns of reference material, none of them ever scanned,
    // taking the width from the one column anyone acts on — which was truncating
    // mid-word. They read fine as a subline; stage moved to the profile, where
    // it's read once.
    cell: ({ row }) => (
      <Link
        href={`/companies/${row.original.id}`}
        className="flex items-center gap-2.5 hover:text-brand-purple-600"
      >
        <CompanyLogo
          name={row.original.name}
          logoPath={row.original.logoPath}
          size="sm"
        />
        <span className="min-w-0">
          <span className="block font-medium">{row.original.name}</span>
          <span className="block text-xs text-muted-foreground">
            {[row.original.industry, row.original.headquarters]
              .filter(Boolean)
              .join(" · ") || "—"}
          </span>
        </span>
      </Link>
    ),
  },
  {
    accessorKey: "activeJobCount",
    header: sortHeader("Roles"),
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.activeJobCount}</span>
    ),
  },
  {
    accessorKey: "accountOwner",
    header: "Owner",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.accountOwner}</span>
    ),
  },
  {
    accessorKey: "completeness",
    // "Complete" invited the question "complete for what?". This is how much of
    // the knowledge base has been written — the comparative measure, which is
    // why it lives on the list rather than in the workspace header.
    header: sortHeader("Knowledge"),
    cell: ({ row }) => (
      <div className="flex w-28 items-center gap-2">
        <Progress value={row.original.completeness} className="flex-1" />
        <span className="text-xs tabular-nums text-muted-foreground">
          {row.original.completeness}%
        </span>
      </div>
    ),
  },
  {
    id: "readiness",
    accessorFn: (row) => READINESS_RANK[row.readiness],
    // Was "Agent status", which named something that doesn't exist: an agent
    // attaches to a job stage, never to a company. What this column actually
    // answers is whether a screening agent could run for this company's roles
    // yet — so it says that, and each label states the consequence rather than
    // the enum.
    header: sortHeader("Screening readiness"),
    cell: ({ row }) => (
      <div className="max-w-sm space-y-1">
        <ReadinessPill status={row.original.readiness} size="sm" />
        <p className="text-xs text-muted-foreground">
          {row.original.readinessHeadline}
        </p>
      </div>
    ),
  },
]

export function CompaniesTable({ data }: { data: CompanyListItem[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "readiness", desc: false },
  ])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      <Table>
        <TableHeader className="bg-muted">
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                No companies found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
