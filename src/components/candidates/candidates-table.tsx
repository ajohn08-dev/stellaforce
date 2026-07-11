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
import { TierBadge } from "@/components/tier-badge"
import { titleCase } from "@/lib/constants"
import type { CandidateRow, ContactInfo } from "@/lib/supabase/types"

function sortHeader(label: string) {
  return function SortableHeader({ column }: { column: { toggleSorting: (d?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) {
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

const columns: ColumnDef<CandidateRow>[] = [
  {
    accessorKey: "full_name",
    header: sortHeader("Name"),
    cell: ({ row }) => (
      <Link
        href={`/candidates/${row.original.candidate_id}`}
        className="font-medium hover:underline"
      >
        {row.original.full_name}
      </Link>
    ),
  },
  {
    accessorKey: "candidate_tier",
    header: sortHeader("Tier"),
    cell: ({ row }) => <TierBadge tier={row.original.candidate_tier} />,
  },
  {
    accessorKey: "current_title",
    header: "Title",
    cell: ({ row }) => row.original.current_title ?? "—",
  },
  {
    accessorKey: "current_company",
    header: "Company",
    cell: ({ row }) => row.original.current_company ?? "—",
  },
  {
    accessorKey: "years_experience",
    header: sortHeader("Yrs"),
    cell: ({ row }) => row.original.years_experience ?? "—",
  },
  {
    id: "location",
    header: "Location",
    accessorFn: (row) => (row.contact_info as ContactInfo | null)?.location ?? "",
    cell: ({ getValue }) => (getValue<string>() || "—"),
  },
  {
    accessorKey: "data_provenance",
    header: "Provenance",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {titleCase(row.original.data_provenance)}
      </span>
    ),
  },
]

export function CandidatesTable({ data }: { data: CandidateRow[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
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
                  <TableCell key={cell.id}>
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
                No candidates found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
