import Link from "next/link"
import { notFound } from "next/navigation"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { TierBadge } from "@/components/tier-badge"
import { getJobOrder } from "@/lib/data"
import { titleCase } from "@/lib/constants"

export default async function JobOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const job = await getJobOrder(id)
  if (!job) notFound()

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {job.title}
            </h1>
            <Badge variant="outline">{titleCase(job.status)}</Badge>
          </div>
          <p className="text-muted-foreground">
            {job.client?.client_name ?? "Unassigned client"}
          </p>
        </div>
        <Link href="/job-orders" className={buttonVariants({ variant: "outline" })}>
          Back
        </Link>
      </div>

      {job.description && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Description
          </h2>
          <p className="text-sm leading-relaxed">{job.description}</p>
        </section>
      )}

      {(job.required_skills ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Required skills
          </h2>
          <div className="flex flex-wrap gap-2">
            {(job.required_skills ?? []).map((s) => (
              <Badge key={s} variant="secondary">
                {s}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Attached candidates ({job.applications.length})
        </h2>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {job.applications.length ? (
                job.applications.map((a) => (
                  <TableRow key={a.application_id}>
                    <TableCell>
                      {a.candidate ? (
                        <Link
                          href={`/candidates/${a.candidate.candidate_id}`}
                          className="font-medium hover:underline"
                        >
                          {a.candidate.full_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <TierBadge tier={a.candidate?.candidate_tier ?? null} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{titleCase(a.stage)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(a.date_applied).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {a.human_review_flag ? (
                        <Badge className="bg-amber-100 text-amber-900 border-transparent dark:bg-amber-950 dark:text-amber-200">
                          Needs review
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No candidates attached yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
