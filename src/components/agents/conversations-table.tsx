"use client"

import * as React from "react"
import {
  type ColumnDef,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { toast } from "sonner"
import { ArrowUpDown, ChevronLeft, ChevronRight, Download, Flag, Trash2 } from "lucide-react"

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
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ConversationDetailSheet } from "@/components/agents/conversation-detail-sheet"
import { formatDate } from "@/lib/constants"
import type { Conversation } from "@/lib/conversations"

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "\u2014"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

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

const columns: ColumnDef<Conversation>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all conversations"
        checked={table.getIsAllRowsSelected()}
        indeterminate={table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()}
        onCheckedChange={(checked) => table.toggleAllRowsSelected(!!checked)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label={`Select conversation with ${row.original.candidate_name ?? "unknown candidate"}`}
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => row.toggleSelected(!!checked)}
      />
    ),
  },
  {
    accessorKey: "agent_name",
    header: "Agent",
    cell: ({ row }) => <span className="block truncate">{row.original.agent_name ?? "\u2014"}</span>,
  },
  {
    accessorKey: "candidate_name",
    header: "Candidate",
    cell: ({ row }) => {
      const { candidate_name, is_test_call } = row.original
      return (
        <span className="flex min-w-0 items-center gap-1.5">
          {/* A test call has no candidate, so the Test badge stands alone
              rather than being prefixed by an empty-value dash. */}
          {candidate_name ? (
            <span className="truncate font-medium">{candidate_name}</span>
          ) : (
            !is_test_call && <span className="font-medium">&mdash;</span>
          )}
          {is_test_call && (
            <Badge variant="outline" className="shrink-0">
              Test
            </Badge>
          )}
        </span>
      )
    },
  },
  {
    accessorKey: "to_number",
    header: "Phone number",
    cell: ({ row }) => (
      <span className="block truncate tabular-nums">
        {row.original.to_number ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "started_on",
    header: sortHeader("Date"),
    cell: ({ row }) =>
      row.original.started_on ? formatDate(row.original.started_on) : "\u2014",
  },
  {
    accessorKey: "duration_seconds",
    header: sortHeader("Duration"),
    cell: ({ row }) => formatDuration(row.original.duration_seconds),
  },
]

const PAGE_SIZE = 25

export function ConversationsTable({ data }: { data: Conversation[] }) {
  // Rows hidden by the (still client-only) Delete action. Tracked as ids over
  // the server-provided `data` rather than snapshotting it into state, so
  // re-filtering/searching — which re-renders this with new props — isn't
  // stuck showing the first render's rows.
  const [deletedIds, setDeletedIds] = React.useState<Set<string>>(new Set())
  const conversations = React.useMemo(
    () => data.filter((c) => !deletedIds.has(c.conversation_id)),
    [data, deletedIds]
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const [selectedConversation, setSelectedConversation] = React.useState<Conversation | null>(
    null
  )
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)

  const table = useReactTable({
    data: conversations,
    columns,
    state: { sorting, rowSelection, pagination },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getRowId: (row) => row.conversation_id,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const pageCount = table.getPageCount()
  const selectedIds = Object.keys(rowSelection)
  const selectedCount = selectedIds.length

  function handleDelete() {
    setDeletedIds((prev) => new Set([...prev, ...selectedIds]))
    setRowSelection({})
    setDeleteConfirmOpen(false)
    toast.info("Hidden for now — deleting conversations isn't wired up yet.")
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-white">
      {selectedCount > 0 && (
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-muted px-4 py-2">
          <span className="text-sm font-medium">{selectedCount} selected</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => toast.info("Not wired up yet — export is coming soon.")}
            >
              <Download className="size-3.5" />
              Export selected
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => toast.info("Not wired up yet — flagging for review is coming soon.")}
            >
              <Flag className="size-3.5" />
              Flag for review
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="size-3.5" />
              Delete selected
            </Button>
          </div>
        </div>
      )}

      <Table containerClassName="min-h-0 flex-1 overflow-y-auto scrollbar-light">
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
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-muted"
                onClick={(e) => {
                  const target = e.target as HTMLElement
                  if (target.closest("a, button, [role='checkbox'], input")) return
                  setSelectedConversation(row.original)
                }}
              >
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
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                No conversations found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {pageCount > 1 && (
        <div className="flex shrink-0 items-center justify-end gap-4 border-t border-border px-4 py-2">
          <span className="text-sm text-muted-foreground">
            Page {pagination.pageIndex + 1} of {pageCount}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}

      <ConversationDetailSheet
        conversation={selectedConversation}
        onOpenChange={(open) => {
          if (!open) setSelectedConversation(null)
        }}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} conversation{selectedCount === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected conversation
              {selectedCount === 1 ? "" : "s"}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
