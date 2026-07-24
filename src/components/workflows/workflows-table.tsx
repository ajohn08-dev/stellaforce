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
import { WorkflowStatusBadge } from "@/components/workflows/workflow-status-badge"
import { WorkflowActions } from "@/components/workflows/workflow-actions"
import { formatDate } from "@/lib/constants"
import type { MockWorkflow } from "@/lib/mock-workflows"

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

const columns: ColumnDef<MockWorkflow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all workflows"
        checked={table.getIsAllRowsSelected()}
        indeterminate={
          table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()
        }
        onCheckedChange={(checked) => table.toggleAllRowsSelected(!!checked)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label={`Select ${row.original.name}`}
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => row.toggleSelected(!!checked)}
      />
    ),
  },
  {
    accessorKey: "name",
    header: sortHeader("Name"),
    cell: ({ row }) => (
      <Link
        href={`/workflows/${row.original.workflow_id}`}
        className="font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "status",
    header: sortHeader("Status"),
    cell: ({ row }) => <WorkflowStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "client_name",
    header: sortHeader("Client"),
    cell: ({ row }) => row.original.client_name ?? "Generic template",
  },
  {
    accessorKey: "department",
    header: sortHeader("Department"),
    cell: ({ row }) => row.original.department,
  },
  {
    accessorKey: "created_by",
    header: sortHeader("Created by"),
    cell: ({ row }) => row.original.created_by,
  },
  {
    accessorKey: "created_at",
    header: sortHeader("Created"),
    cell: ({ row }) => formatDate(row.original.created_at),
  },
  {
    accessorKey: "updated_at",
    header: sortHeader("Updated"),
    cell: ({ row }) => formatDate(row.original.updated_at),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div className="flex items-center justify-end">
        <WorkflowActions workflow={row.original} />
      </div>
    ),
  },
]

export function WorkflowsTable({ data }: { data: MockWorkflow[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.workflow_id,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="h-full overflow-y-auto rounded-lg border border-border bg-white">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted/50">
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
                No workflows found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
