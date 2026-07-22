"use client"

import * as React from "react"
import Link from "next/link"
import {
  type Column,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, Globe } from "lucide-react"

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
import { CandidateActions } from "@/components/candidates/candidate-actions"
import { GithubIcon } from "@/components/icons/brand-icons"
import { isGithubUrl, cn } from "@/lib/utils"
import type { CandidateListItem } from "@/lib/data"

function IconLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      aria-label={label}
      className="text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
    </a>
  )
}

function DataLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="block truncate text-brand-purple-600 hover:underline"
    >
      {children}
    </a>
  )
}

/**
 * Pixel position for pinned columns, computed by TanStack Table from each
 * column's declared `size` — NOT guessed Tailwind offsets. Guessed offsets
 * (e.g. `left-10`) drift out of sync with the actual rendered column widths
 * on an auto-layout table, which is what caused the overlap bug; this is
 * the library's own documented fix (see "Column Pinning" in their docs).
 */
function pinnedStyle(column: Column<CandidateListItem, unknown>): React.CSSProperties {
  const pinned = column.getIsPinned()
  return {
    width: column.getSize(),
    position: pinned ? "sticky" : undefined,
    left: pinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: pinned === "right" ? `${column.getAfter("right")}px` : undefined,
    zIndex: pinned ? 20 : undefined,
  }
}

/**
 * Opaque backgrounds for pinned cells so columns scrolling underneath don't
 * show through — bg-muted/50 (50% alpha) was the bug: it's translucent by
 * design for ordinary row hover, but that means "hover" on a pinned column
 * let whatever was scrolled beneath bleed through. Pinned cells need a fully
 * opaque background at all times, hover included.
 */
function pinnedClassName(
  column: Column<CandidateListItem, unknown>,
  variant: "header" | "cell"
): string | undefined {
  if (!column.getIsPinned()) return undefined
  const edge =
    column.id === "full_name"
      ? "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
      : column.id === "actions"
        ? "shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.08)]"
        : ""
  return cn(variant === "header" ? "bg-muted" : "bg-white group-hover:bg-muted", edge)
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

const columns: ColumnDef<CandidateListItem>[] = [
  {
    id: "select",
    size: 40,
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
    size: 220,
    header: sortHeader("Name"),
    cell: ({ row }) => (
      <Link
        href={`/candidates/${row.original.candidate_id}`}
        className="flex items-center gap-2.5 truncate font-medium hover:text-brand-purple-600"
      >
        <CandidateAvatar
          name={row.original.full_name ?? ""}
          firstName={row.original.first_name}
          lastName={row.original.last_name}
          avatarUrl={row.original.avatar_url}
          className="size-7 shrink-0"
        />
        <span className="truncate">{row.original.full_name}</span>
      </Link>
    ),
  },
  {
    id: "title",
    size: 160,
    header: "Title",
    accessorFn: (row) => row.currentRole?.title ?? "",
    cell: ({ row }) => (
      <span className="block truncate">{row.original.currentRole?.title ?? "—"}</span>
    ),
  },
  {
    id: "company",
    size: 160,
    header: "Company",
    accessorFn: (row) => row.currentRole?.company_name ?? "",
    cell: ({ row }) => (
      <span className="block truncate">
        {row.original.currentRole?.company_name ?? "—"}
      </span>
    ),
  },
  {
    id: "profile",
    size: 260,
    header: "Profile",
    accessorFn: (row) => row.linkedin_url ?? "",
    cell: ({ row }) =>
      row.original.linkedin_url ? (
        <DataLink href={row.original.linkedin_url}>{row.original.linkedin_url}</DataLink>
      ) : (
        "—"
      ),
  },
  {
    id: "email",
    size: 220,
    header: "Email",
    accessorFn: (row) => row.email ?? "",
    cell: ({ row }) =>
      row.original.email ? (
        <DataLink href={`mailto:${row.original.email}`}>{row.original.email}</DataLink>
      ) : (
        "—"
      ),
  },
  {
    id: "phone",
    size: 140,
    header: "Phone",
    accessorFn: (row) => row.phone ?? "",
    cell: ({ row }) =>
      row.original.phone ? (
        <DataLink href={`tel:${row.original.phone}`}>{row.original.phone}</DataLink>
      ) : (
        "—"
      ),
  },
  {
    accessorKey: "candidate_tier",
    size: 100,
    header: sortHeader("Tier"),
    cell: ({ row }) => <TierBadge tier={row.original.candidate_tier} />,
  },
  {
    accessorKey: "years_experience",
    size: 70,
    header: sortHeader("Yrs"),
    cell: ({ row }) => row.original.years_experience ?? "—",
  },
  {
    id: "location",
    size: 160,
    header: "Location",
    accessorFn: (row) => row.location_raw ?? "",
    cell: ({ getValue }) => (
      <span className="block truncate">{getValue<string>() || "—"}</span>
    ),
  },
  {
    id: "actions",
    // Portfolio icon + Shortlist button (text+icon) + preview/full-view icon
    // buttons — this needs real room, not a compact icon-only column. The
    // previous 120px was too narrow, so the content overflowed its cell
    // leftward into Location (the same "declared size < real content"
    // mistake as the earlier overlap bug, just on a different column).
    size: 300,
    header: "",
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-3">
        {row.original.portfolio_url &&
          (isGithubUrl(row.original.portfolio_url) ? (
            <IconLink href={row.original.portfolio_url} label="GitHub">
              <GithubIcon className="size-4" />
            </IconLink>
          ) : (
            <IconLink href={row.original.portfolio_url} label="Portfolio">
              <Globe className="size-4" />
            </IconLink>
          ))}
        <CandidateActions candidate={row.original} />
      </div>
    ),
  },
]

export function CandidatesTable({ data }: { data: CandidateListItem[] }) {
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
    initialState: {
      columnPinning: { left: ["select", "full_name"], right: ["actions"] },
    },
  })

  return (
    <div className="h-full overflow-y-auto rounded-lg border border-border bg-white">
      <Table className="table-fixed" containerClassName="scrollbar-light">
        <TableHeader className="sticky top-0 z-10 bg-muted">
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={pinnedStyle(header.column)}
                  className={pinnedClassName(header.column, "header")}
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
              <TableRow key={row.id} className="group hover:bg-muted">
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    style={pinnedStyle(cell.column)}
                    className={pinnedClassName(cell.column, "cell")}
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
