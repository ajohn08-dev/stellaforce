"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, MessageCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AskComposer } from "@/components/chat/ask-composer"
import { cn } from "@/lib/utils"
import { parseCandidateSearchParams } from "@/lib/candidate-search"
import { runAiCandidateSearch } from "@/app/(app)/candidates/search/actions"

/**
 * The left navigation for Advanced Search. Two ways to ask one question,
 * switched by the toggle at the top:
 *
 *   **Filters**        five structured fields, applied together by the CTA
 *   **Search with AI** the shared chat surface, describing who you want
 *
 * The toggle replaces what was a "Filters" heading — it names the section and
 * switches it, so a separate title would only repeat the active tab.
 *
 * **Both tabs drive one search state.** The AI tab does not search: it parses
 * the sentence into filter values server-side, then writes them into the same
 * six URL params the Filters tab writes. The page re-renders from
 * `searchParams` and runs the one `searchCandidates` — so the results table
 * updates, the Filters inputs show the parsed values with no second
 * submission, and pagination resets. The model never sees a candidate.
 *
 * Filters are **explicitly applied**, not applied as you type. Five fields that
 * each re-ran the search mid-keystroke meant a half-typed title narrowed the
 * table to nothing on the way to a real query, and building a multi-field search
 * meant watching four intermediate result sets you never asked for. One Apply
 * makes the filled-in state and the queried state the same thing.
 *
 * Only the Filters tab is a `<form>`, so Enter in any field applies — the
 * keyboard path a recruiter filling five fields will actually use, and free.
 * The chat tab is deliberately outside it: nesting a composer in a search form
 * makes Enter ambiguous and a stray submit button dangerous.
 *
 * Applied state lives in the URL, matching how `/candidates` already carries
 * `?tiers=` / `?q=` / `?view=`. That keeps the search shareable, keeps the back
 * button meaningful, and lets the page stay a Server Component that just reads
 * its own `searchParams`. `push`, not `replace`: with an explicit Apply each
 * search is a deliberate step worth having in history.
 *
 * Validation runs through `parseCandidateSearchParams` — the same function the
 * server uses — so the message shown here and the refusal there can't disagree.
 * An invalid range disables Apply outright, so an invalid search is never run.
 *
 * A rail rather than a bar because the set of filters will grow: a horizontal
 * row runs out of width at five and wraps into what reads like two rows of
 * unrelated controls, while a column just gets taller and scrolls.
 */

type FilterKey = "name" | "title" | "location" | "skills" | "minYears" | "maxYears"

const FILTER_KEYS: FilterKey[] = [
  "name",
  "title",
  "location",
  "skills",
  "minYears",
  "maxYears",
]

type FilterValues = Record<FilterKey, string>

const EMPTY_VALUES: FilterValues = Object.fromEntries(
  FILTER_KEYS.map((key) => [key, ""])
) as FilterValues

type RailMode = "filters" | "ai"

/**
 * Starters phrased as a recruiter would ask, and deliberately describing the
 * same five things the structured rail filters on — so the two modes read as
 * two ways to ask one question rather than two unrelated tools.
 */
const AI_PROMPTS = [
  "Account executives in Boston with 5+ years",
  "Product designers who know Figma",
  "Engineers with 3–8 years, open to remote",
]

/** Fixed copy, so the same situation always reads the same way. */
const UNSUPPORTED_REPLY =
  "I can currently help search candidates. Try describing a title, location, skills, or years of experience."
const NO_FILTERS_REPLY =
  "Try a candidate search with a title, city, skill, name, or years of experience."
const ERROR_REPLY =
  "I couldn't interpret that search. Please try again with a title, city, skills, or years of experience."
/**
 * Says what is actually wrong and what still works. "Try rephrasing" would be
 * false here — no wording succeeds until the key is fixed.
 */
const NOT_CONFIGURED_REPLY =
  "AI search isn't set up on this environment yet, so I can't interpret that. The Filters tab works — or ask an admin to add a valid Anthropic API key."

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  /** Rendered under the message in a muted tone — never as an error. */
  notice?: string
}

/**
 * The conversation and the active tab survive a reload and a trip to another
 * page, because losing them doesn't read as "state expired" — it reads as the
 * search having been thrown away. The results themselves already survive (they
 * are in the URL), so a blank chat beside a filtered table is the worst of both.
 *
 * `sessionStorage`, not the URL: a conversation can't live in a query string,
 * and a `mode=ai` param would mean a shared link dictated which tool the
 * recipient opened in. Per-tab and cleared when the tab closes, which is the
 * right lifetime for something this disposable — this is not saved searches.
 */
const STORAGE_KEY = "stellaforce:advanced-search:ai"
/** Bounded so a long session can't grow toward the ~5MB per-origin ceiling. */
const MAX_PERSISTED_MESSAGES = 50

type PersistedRail = { mode: RailMode; messages: ChatMessage[] }

function readPersisted(): PersistedRail | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    // Hand-checked rather than trusted: this is our own data, but it is still
    // input, and a stale shape from an older deploy must not crash the rail.
    if (typeof parsed !== "object" || parsed === null) return null
    const { mode, messages } = parsed as Partial<PersistedRail>
    if (mode !== "ai" && mode !== "filters") return null
    if (!Array.isArray(messages)) return null
    const clean = messages.filter(
      (m): m is ChatMessage =>
        !!m &&
        typeof m.id === "string" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.text === "string"
    )
    return { mode, messages: clean }
  } catch {
    return null // private mode, quota, corrupt JSON — never worth breaking on
  }
}

function writePersisted(value: PersistedRail) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode: value.mode,
        messages: value.messages.slice(-MAX_PERSISTED_MESSAGES),
      })
    )
  } catch {
    // Storage disabled or full. The rail keeps working in memory.
  }
}

/**
 * "Searching candidates with: …" — built from what was actually extracted, so
 * the recruiter can see the interpretation before trusting the result set. Only
 * filters that were extracted appear; nothing is invented to fill the list.
 */
function interpretationSummary(filters: {
  name: string | null
  title: string | null
  location: string | null
  skills: string[]
  minYears: number | null
  maxYears: number | null
}): string {
  const lines: string[] = []
  if (filters.name) lines.push(`Name: ${filters.name}`)
  if (filters.title) lines.push(`Title: ${filters.title}`)
  if (filters.location) lines.push(`Location: ${filters.location}`)
  if (filters.skills.length) lines.push(`Skills: ${filters.skills.join(", ")}`)

  const { minYears: lo, maxYears: hi } = filters
  if (lo !== null && hi !== null) lines.push(`Experience: ${lo}–${hi} years`)
  else if (lo !== null) lines.push(`Experience: ${lo}+ years`)
  else if (hi !== null) lines.push(`Experience: up to ${hi} years`)

  return ["Searching candidates with:", ...lines.map((l) => `-  ${l}`)].join("\n")
}

/**
 * `useLayoutEffect` warns when React renders on the server, where it can't run.
 * The restore below must be a layout effect on the client (to commit before
 * paint) and a no-op on the server, which is exactly this swap.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

function valuesFromParams(params: URLSearchParams): FilterValues {
  return Object.fromEntries(
    FILTER_KEYS.map((key) => [key, params.get(key) ?? ""])
  ) as FilterValues
}

export function AdvancedSearchFilters() {
  const router = useRouter()
  const params = useSearchParams()
  const paramsKey = params.toString()

  /**
   * A query handed over by the ask bar on /candidates. Arriving with `?q=`
   * means "this was already asked" — so the rail opens on the AI tab with the
   * message already in the conversation and runs it without a second send.
   */
  const seededQuery = params.get("q")?.trim() ?? ""

  // Mode is local, not URL state: it's how you're composing a search, not part
  // of the search itself. Putting it in the URL would make two links to the
  // same result set differ, and would mean a shared search dictated the
  // recipient's choice of tool. `?q=` is the one exception — it isn't a filter,
  // it's a handoff, and it only sets the *initial* tab.
  //
  // ⚠️ **Applying filters must never change the tab.** `setMode` belongs to the
  // two tab buttons and nothing else: running an AI search leaves you in the
  // conversation, and the Filters tab is shown only when you ask for it. The
  // `router.push` that applies the filters is a soft navigation, so this state
  // survives it — which is also why there must be no `template.tsx`,
  // `loading.tsx`, or `key` on this component. Any of those would remount the
  // rail mid-search and silently drop you back onto Filters.
  const [mode, setMode] = React.useState<RailMode>(seededQuery ? "ai" : "filters")
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [pending, setPending] = React.useState(false)
  /** Gates the auto-run so a handoff can't fire before the restore lands. */
  const [restored, setRestored] = React.useState(false)
  const bottomRef = React.useRef<HTMLDivElement>(null)

  /**
   * Restore the previous conversation, then append the handoff message if this
   * visit brought one. Runs in a layout effect so it commits before paint —
   * with a plain effect you'd see an empty chat for a frame on every reload.
   *
   * The restore has to happen here rather than in a `useState` initializer:
   * reading `sessionStorage` during render would make the client's first render
   * disagree with the server's, which React 19 treats as a hydration error.
   */
  useIsomorphicLayoutEffect(() => {
    const saved = readPersisted()
    if (saved) {
      setMode(saved.mode)
      setMessages(saved.messages)
    }
    if (seededQuery) {
      // A handoff always opens the conversation, even if the saved tab was
      // Filters — the recruiter just asked something.
      setMode("ai")
      setMessages((prev) =>
        // Guard against re-appending on a reload that still carries `?q=`
        // (which happens when the previous parse failed).
        prev[prev.length - 1]?.text === seededQuery
          ? prev
          : [...prev, { id: crypto.randomUUID(), role: "user", text: seededQuery }]
      )
    }
    setRestored(true)
    // Mount-only, deliberately: a later `?q=` always arrives as a fresh mount
    // from /candidates, and re-running this on any other change would re-append
    // the handoff. Note the deps here are not lint-enforced — the rule doesn't
    // recognise the isomorphic alias as a hook — so keep this list empty by
    // intent, not by accident.
  }, [])

  // Persist after every change. Cheap, and it means a reload mid-conversation
  // loses at most the in-flight request.
  React.useEffect(() => {
    if (!restored) return // don't clobber storage with the pre-restore empty state
    writePersisted({ mode, messages })
  }, [restored, mode, messages])

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [messages, pending])

  /**
   * Parse a natural-language query server-side, show the interpretation, and —
   * when it produced usable filters — apply them through exactly the same URL
   * the Filters tab writes. That is what makes one search state serve both tabs:
   * the page re-renders from `searchParams`, the results table updates, and
   * switching to Filters shows the parsed values already in the inputs. No
   * second submission, no duplicated filter state.
   *
   * Does not echo the user's message — the two callers differ on that. A typed
   * send appends it; a `?q=` handoff already has it in the seeded state.
   */
  const runQuery = React.useCallback(async (trimmed: string) => {
    setPending(true)

    const reply = (replyText: string, notice?: string) =>
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: replyText, notice },
      ])

    try {
      const result = await runAiCandidateSearch(trimmed)

      if (result.status === "unsupported") return reply(UNSUPPORTED_REPLY)
      if (result.status === "no_filters") return reply(NO_FILTERS_REPLY)
      if (result.status === "not_configured") return reply(NOT_CONFIGURED_REPLY)
      if (result.status === "error") return reply(ERROR_REPLY)

      const { filters: parsed, unsupportedRequirements } = result
      reply(
        interpretationSummary(parsed),
        unsupportedRequirements.length
          ? `Not yet included: ${unsupportedRequirements.join(", ")}.`
          : undefined
      )

      // Write the parsed values into the same six params the rail uses. `page`
      // is omitted, which resets pagination — a new filter set makes the old
      // page number meaningless.
      const sp = new URLSearchParams()
      if (parsed.name) sp.set("name", parsed.name)
      if (parsed.title) sp.set("title", parsed.title)
      if (parsed.location) sp.set("location", parsed.location)
      if (parsed.skills.length) sp.set("skills", parsed.skills.join(", "))
      if (parsed.minYears !== null) sp.set("minYears", String(parsed.minYears))
      if (parsed.maxYears !== null) sp.set("maxYears", String(parsed.maxYears))
      // Note this also drops `q` from the URL, which is what stops a handed-over
      // query from re-running on a later navigation.
      router.push(`/candidates/search?${sp.toString()}`, { scroll: false })
    } catch {
      // A rejected action (network drop, deploy mid-flight) must read the same
      // as a parse failure — never a raw error.
      reply(ERROR_REPLY)
    } finally {
      setPending(false)
    }
  }, [router])

  /** A typed send: echo the message, then run it. */
  async function handleSend(text: string) {
    if (pending) return // guard against a double submit racing two searches
    const trimmed = text.trim()
    if (!trimmed) return
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text: trimmed },
    ])
    await runQuery(trimmed)
  }

  // Run the handed-over query exactly once. The ref is keyed on the query text
  // rather than a boolean so a second handoff with different text still runs,
  // while a re-render or a StrictMode double-invoke does not fire two searches.
  const handoffRunRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!restored) return // wait for the conversation to be rehydrated first
    if (!seededQuery || handoffRunRef.current === seededQuery) return
    handoffRunRef.current = seededQuery
    void runQuery(seededQuery)
  }, [restored, seededQuery, runQuery])

  // Seeded from the URL so a shared or reloaded search shows its own filters.
  const [values, setValues] = React.useState<FilterValues>(() =>
    valuesFromParams(params)
  )

  // Re-sync when the URL changes underneath us — browser back/forward, or the
  // pagination controls. Typing never changes the URL, so this cannot fight the
  // user mid-edit; applying sets the URL to what's already on screen, so it
  // lands as a no-op there too. Without this, Back would move the table to the
  // previous search while the rail kept showing the newer one.
  //
  // Adjusted during render rather than in an effect — React's documented way to
  // reset state when a value changes, and the only one that doesn't cascade a
  // second render. Remounting via `key` from the page would work too, but it
  // would drop focus out of the field on every apply.
  const [syncedKey, setSyncedKey] = React.useState(paramsKey)
  if (syncedKey !== paramsKey) {
    setSyncedKey(paramsKey)
    setValues(valuesFromParams(new URLSearchParams(paramsKey)))
  }

  // Validate what's on screen, not what's applied — otherwise a bad value would
  // show no message until you tried to apply it.
  const { issues, hasBlockingIssue } = React.useMemo(
    () => parseCandidateSearchParams(values),
    [values]
  )

  function apply(e: React.FormEvent) {
    e.preventDefault()
    if (hasBlockingIssue) return

    const sp = new URLSearchParams()
    for (const key of FILTER_KEYS) {
      const value = values[key].trim()
      if (value) sp.set(key, value)
    }
    // `page` is deliberately never carried over: applying a different filter
    // makes the old page number meaningless, and landing on page 4 of a 2-page
    // result is how a changed filter looks like an empty one.
    const qs = sp.toString()
    router.push(qs ? `/candidates/search?${qs}` : "/candidates/search", {
      scroll: false,
    })
  }

  /**
   * Clearing empties the fields *and* drops the applied filters, because a
   * "Clear filters" that blanked the rail while the table stayed filtered would
   * be describing a state the page isn't in.
   *
   * The fields are reset here rather than left to the URL sync: when nothing is
   * applied yet, pushing an already-param-free URL doesn't change `paramsKey`,
   * so the sync wouldn't fire and typed-but-unapplied text would survive a
   * click on Clear.
   */
  function clear() {
    setValues(EMPTY_VALUES)
    router.push("/candidates/search", { scroll: false })
  }

  // Nothing typed and nothing applied means nothing to clear. Both halves are
  // needed: fields can hold unapplied text, and the URL can hold filters the
  // fields were manually emptied of.
  const canClear =
    FILTER_KEYS.some((key) => values[key].trim()) ||
    FILTER_KEYS.some((key) => params.get(key))

  function set(key: FilterKey, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="flex h-full flex-col">
      {/* The toggle replaces the old "Filters" heading — it names the section
          and switches it, so a separate title would only repeat the active tab. */}
      <div className="shrink-0 border-b border-border p-3">
        <div
          role="tablist"
          aria-label="Search mode"
          className="flex items-center rounded-lg border border-border p-0.5"
        >
          <ModeTab
            active={mode === "filters"}
            onClick={() => setMode("filters")}
            controls="rail-filters"
          >
            Filters
          </ModeTab>
          <ModeTab
            active={mode === "ai"}
            onClick={() => setMode("ai")}
            controls="rail-ai"
          >
            Search with AI
          </ModeTab>
        </div>
      </div>

      {mode === "ai" ? (
        <div
          id="rail-ai"
          role="tabpanel"
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {/* Same shape as /chat: a scrolling conversation with the shared chat
              bar pinned beneath it. */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4 no-scrollbar">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-2 text-center text-muted-foreground">
                <MessageCircle className="size-5" />
                <p className="text-xs">
                  Describe who you&apos;re looking for to get started
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex flex-col gap-1",
                      message.role === "user" ? "items-end" : "items-start"
                    )}
                  >
                    <div
                      className={cn(
                        // `whitespace-pre-line` so the interpretation summary
                        // keeps its one-filter-per-line shape.
                        "max-w-[85%] rounded-2xl px-3 py-2 text-xs whitespace-pre-line",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {message.text}
                    </div>
                    {/* Non-blocking: the supported filters were applied. Muted,
                        not red — this is disclosure, not a failure. */}
                    {message.notice && (
                      <p className="max-w-[85%] px-1 text-[11px] text-muted-foreground">
                        {message.notice}
                      </p>
                    )}
                  </div>
                ))}
                {pending && (
                  <div className="flex items-start">
                    <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      Interpreting your search…
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* The same composer as everywhere else. `affordances` is off: the
              rail is 280px, and the +/options/panel icons would leave no room
              for the field itself. */}
          <div className="shrink-0 border-t border-border p-3">
            <AskComposer
              placeholder="Describe who you're looking for…"
              prompts={AI_PROMPTS}
              onSend={handleSend}
              disabled={pending}
            />
          </div>
        </div>
      ) : (
        <form
          id="rail-filters"
          role="tabpanel"
          onSubmit={apply}
          className="flex min-h-0 flex-1 flex-col"
        >
          {/* The fields scroll on their own so the rail survives more filters
              than fit — and so Apply never scrolls out of reach. */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <Field
          id="filter-name"
          label="Name"
          placeholder="Any name"
          value={values.name}
          onChange={(v) => set("name", v)}
        />
        <Field
          id="filter-title"
          label="Title"
          placeholder="e.g. Account Executive"
          value={values.title}
          onChange={(v) => set("title", v)}
        />
        <Field
          id="filter-location"
          label="Location"
          placeholder="e.g. Boston"
          value={values.location}
          onChange={(v) => set("location", v)}
        />
        <Field
          id="filter-skills"
          label="Skills"
          placeholder="e.g. Salesforce, Outreach"
          value={values.skills}
          onChange={(v) => set("skills", v)}
          hint="Matches any of these"
        />

        {/* Experience is a range, so it gets two inputs sharing one label
            rather than a single box whose meaning depends on what you type. */}
        <div className="space-y-2">
          <Label id="years-of-experience-label">Years of experience</Label>
          <div
            role="group"
            aria-labelledby="years-of-experience-label"
            className="flex items-center gap-2"
          >
            <Input
              inputMode="numeric"
              value={values.minYears}
              onChange={(e) => set("minYears", e.target.value)}
              placeholder="Min"
              aria-label="Minimum years of experience"
              aria-invalid={!!issues.minYears}
              aria-describedby={issues.minYears ? "min-years-error" : undefined}
              className={cn("min-w-0 bg-white", issues.minYears && "border-destructive")}
            />
            <span className="shrink-0 text-sm text-muted-foreground" aria-hidden>
              –
            </span>
            <Input
              inputMode="numeric"
              value={values.maxYears}
              onChange={(e) => set("maxYears", e.target.value)}
              placeholder="Max"
              aria-label="Maximum years of experience"
              aria-invalid={!!issues.maxYears}
              aria-describedby={issues.maxYears ? "max-years-error" : undefined}
              className={cn("min-w-0 bg-white", issues.maxYears && "border-destructive")}
            />
          </div>
          {issues.minYears && (
            <p id="min-years-error" className="text-xs text-destructive">
              Min: {issues.minYears}
            </p>
          )}
          {issues.maxYears && (
            <p id="max-years-error" className="text-xs text-destructive">
              Max: {issues.maxYears}
            </p>
          )}
        </div>
      </div>

          {/* Pinned below the scroll area, so both stay reachable however many
              filters are in the rail. Stacked rather than side by side: at
              280px two half-width buttons would each be ~130px, which crowds
              the labels and makes the primary action no more prominent than
              the secondary. */}
          <div className="flex shrink-0 flex-col gap-2 border-t border-border p-4">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={hasBlockingIssue}
            >
              Apply filters
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              disabled={!canClear}
              onClick={clear}
            >
              Clear filters
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

function ModeTab({
  active,
  onClick,
  controls,
  children,
}: {
  active: boolean
  onClick: () => void
  controls: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function Field({
  id,
  label,
  placeholder,
  value,
  onChange,
  hint,
}: {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  hint?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-white"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
