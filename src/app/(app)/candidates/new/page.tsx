import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { NewCandidate } from "@/components/candidates/new-candidate"
import { SupabaseNotice } from "@/components/supabase-notice"

export default function NewCandidatePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Add candidate</h1>
          <p className="text-sm text-muted-foreground">
            Manual entry or AI-assisted ingestion with human confirmation.
          </p>
        </div>
        <Link href="/candidates" className={buttonVariants({ variant: "outline" })}>
          Back
        </Link>
      </div>
      <SupabaseNotice />
      <NewCandidate />
    </div>
  )
}
