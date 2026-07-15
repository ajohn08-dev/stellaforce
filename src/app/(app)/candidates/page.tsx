import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { CandidatesTable } from "@/components/candidates/candidates-table"
import { CandidateFilters } from "@/components/candidates/candidate-filters"
import { SupabaseNotice } from "@/components/supabase-notice"
import { getCandidates } from "@/lib/data"

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined)

  const candidates = await getCandidates({
    tier: get("tier"),
    skill: get("skill"),
    location: get("location"),
    q: get("q"),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
          <p className="text-sm text-muted-foreground">
            {candidates.length} candidate{candidates.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/candidates/new" className={buttonVariants()}>
          Add candidate
        </Link>
      </div>

      <SupabaseNotice />
      <CandidateFilters />
      <CandidatesTable data={candidates} />
    </div>
  )
}
