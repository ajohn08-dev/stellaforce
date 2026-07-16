"use client"

import * as React from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CandidateSearch } from "@/components/candidates/candidate-search"
import { CandidateFilterButton } from "@/components/candidates/candidate-filter-button"
import { cn } from "@/lib/utils"

type Tab = "filters" | "semantic"

export function SearchTabs() {
  const [tab, setTab] = React.useState<Tab>("filters")

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-lg border border-border p-1">
        <TabButton active={tab === "filters"} onClick={() => setTab("filters")}>
          Filters
        </TabButton>
        <TabButton
          active={tab === "semantic"}
          onClick={() => setTab("semantic")}
        >
          Semantic
        </TabButton>
      </div>

      {tab === "filters" ? <FiltersTab /> : <SemanticTab />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 rounded-md text-sm transition-colors",
        active
          ? "bg-muted text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function FiltersTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Structured search by name and tier. Applying takes you to the full
        candidate list.
      </p>
      <div className="flex items-center gap-2">
        <CandidateSearch />
        <CandidateFilterButton />
      </div>
    </div>
  )
}

function SemanticTab() {
  const [query, setQuery] = React.useState("")

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Natural-language search over candidate embeddings.
        </p>
        <Badge variant="outline">TODO — stub</Badge>
      </div>

      <Textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g. Senior React engineer with LLM tooling experience, open to remote…"
        className="min-h-28"
      />

      <div className="flex items-center gap-3">
        <Button disabled>Search (not wired)</Button>
        <span className="text-xs text-muted-foreground">
          Wire an embeddings provider + a pgvector similarity RPC to enable this.
        </span>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Implementation notes</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Embed the query with the same provider used for{" "}
            <code className="font-mono">candidates.embedding_vector</code> (see{" "}
            <code className="font-mono">src/lib/ai/embeddings.ts</code>).
          </li>
          <li>
            Add a Postgres RPC using{" "}
            <code className="font-mono">
              embedding_vector &lt;=&gt; query
            </code>{" "}
            (cosine) ordered ascending, backed by the ivfflat index.
          </li>
          <li>Call it from a Server Action and render ranked candidates.</li>
        </ul>
      </div>

      <p className="text-xs text-muted-foreground">
        Meanwhile, use{" "}
        <Link href="/candidates" className="underline">
          structured search
        </Link>
        .
      </p>
    </div>
  )
}
