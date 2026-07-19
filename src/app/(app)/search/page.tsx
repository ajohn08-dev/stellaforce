import { Suspense } from "react"

import { SearchTabs } from "@/components/search/search-tabs"
import { SupabaseNotice } from "@/components/supabase-notice"

export default function SearchPage() {
  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground">
          Structured filters and semantic (embedding) search.
        </p>
      </div>
      <SupabaseNotice />
      <Suspense fallback={null}>
        <SearchTabs />
      </Suspense>
    </div>
  )
}
