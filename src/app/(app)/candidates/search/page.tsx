import Link from "next/link"
import { ArrowLeft, Sparkle } from "lucide-react"

/**
 * PLACEHOLDER. The destination for the floating ask bar on /candidates — it
 * exists so the flow completes end to end, and nothing more. The real results
 * experience (how the query is parsed, what a match looks like, how it folds
 * back into the candidates list) is still to be defined.
 */
export default async function CandidateSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const q = typeof sp.q === "string" ? sp.q : ""

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16">
      <Link
        href="/candidates"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to candidates
      </Link>

      <div className="mt-6 rounded-xl border border-border bg-white p-6 dark:bg-white">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkle className="size-4 fill-current" />
          <span className="text-xs font-medium tracking-wide uppercase">
            You asked for
          </span>
        </div>
        <p className="mt-3 text-lg text-foreground">
          {q || "Nothing — no query was passed."}
        </p>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        This page is a placeholder. The query above is carried through verbatim
        and hasn&apos;t been parsed or run against anything yet.
      </p>
    </div>
  )
}
