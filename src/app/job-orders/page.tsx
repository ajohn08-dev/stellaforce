import Link from "next/link"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { SupabaseNotice } from "@/components/supabase-notice"
import { getJobOrders } from "@/lib/data"
import { titleCase } from "@/lib/constants"
import type { SalaryRange } from "@/lib/supabase/types"

function formatSalary(range: SalaryRange | null): string {
  if (!range || (range.min == null && range.max == null)) return "—"
  const cur = range.currency ?? "$"
  const fmt = (n?: number) => (n != null ? `${cur}${n.toLocaleString()}` : "?")
  return `${fmt(range.min)} – ${fmt(range.max)}`
}

export default async function JobOrdersPage() {
  const jobs = await getJobOrders()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Job Orders</h1>
        <p className="text-sm text-muted-foreground">
          {jobs.length} order{jobs.length === 1 ? "" : "s"}
        </p>
      </div>

      <SupabaseNotice />

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Salary range</TableHead>
              <TableHead>Required skills</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length ? (
              jobs.map((j) => (
                <TableRow key={j.job_id}>
                  <TableCell>
                    <Link
                      href={`/job-orders/${j.job_id}`}
                      className="font-medium hover:underline"
                    >
                      {j.title}
                    </Link>
                  </TableCell>
                  <TableCell>{j.client?.client_name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{titleCase(j.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    {formatSalary(j.salary_range as SalaryRange | null)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {(j.required_skills ?? []).slice(0, 4).join(", ") || "—"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No job orders yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
