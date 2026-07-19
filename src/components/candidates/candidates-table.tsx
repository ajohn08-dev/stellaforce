"use client"

import * as React from "react"
import Link from "next/link"
import {
  type ColumnDef,
  type RowSelectionState,
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
import { Checkbox } from "@/components/ui/checkbox"
import { TierBadge } from "@/components/tier-badge"
import { CandidateAvatar } from "@/components/candidate-avatar"
import { CandidateSocialLinks } from "@/components/candidates/candidate-social-links"
import { CandidateActions } from "@/components/candidates/candidate-actions"
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
    id: "select",
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all candidates"
        checked={table.getIsAllRowsSelected()}
        indeterminate={
          table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()
        }
        onCheckedChange={(checked) => table.toggleAllRowsSelected(!!checked)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label={`Select ${row.original.full_name}`}
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => row.toggleSelected(!!checked)}
      />
    ),
  },
  {
    accessorKey: "full_name",
    header: sortHeader("Name"),
    cell: ({ row }) => (
      <Link
        href={`/candidates/${row.original.candidate_id}`}
        className="flex items-center gap-2.5 font-medium hover:text-brand-purple-600"
      >
        <CandidateAvatar name={row.original.full_name} className="size-7" />
        {row.original.full_name}
      </Link>
    ),
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
    accessorKey: "candidate_tier",
    header: sortHeader("Tier"),
    cell: ({ row }) => <TierBadge tier={row.original.candidate_tier} />,
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
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-3">
        <CandidateSocialLinks candidate={row.original} />
        <CandidateActions candidate={row.original} />
      </div>
    ),
  },
]

export function CandidatesTable({ data }: { data: CandidateRow[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.candidate_id,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="h-full overflow-y-auto rounded-lg border border-border">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted">
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={header.column.id === "select" ? "w-10" : undefined}
                >
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
                  <TableCell
                    key={cell.id}
                    className={cell.column.id === "select" ? "w-10" : undefined}
                  >
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
