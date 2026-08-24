"use client"

import * as React from "react"

/**
 * The company-wide draft buffer — **it holds the edited values, not just a
 * count**.
 *
 * That distinction is the whole feature. An earlier version kept each field's
 * value in its own component state and only registered a dirty flag here, which
 * looked right until you navigated: `?section=` remounts the page, so the fields
 * reset to their stored values while the pending count (living in the layout)
 * kept counting them. You'd edit Benefits, walk to Profile, come back, and find
 * your text gone but the header still offering to publish three changes.
 *
 * Keeping the values here means editing is genuinely batched across the whole
 * company: edit the profile, then benefits, then a question, move between them
 * freely, and publish all of it once.
 *
 * The provider lives in `layout.tsx` rather than the page, because a
 * `?section=` change re-renders the page but preserves the layout.
 *
 * UI only: Publish adopts the drafts as the new baseline without persisting.
 */

export type DraftValue = string | string[]

export type PendingChange = {
  /** Stable per field, e.g. `policy:pol-lg-10:value`. See `company-draft-keys.ts`. */
  key: string
  /** Section key the field lives in, so changes can be grouped for review. */
  section: string
  /** Human label for the review list, e.g. "Health benefits". */
  label: string
  /**
   * What it said before, and what it says now.
   *
   * The buffer always held both and the change list discarded them, so Publish
   * could only name the fields that changed. That's the wrong altitude for
   * reviewing a candidate-facing claim: the most consequential edits here are
   * one word inside a paragraph — "may be considered" becoming "will be
   * provided" is a different legal position and an identical field name.
   */
  baseline: DraftValue
  value: DraftValue
}

type Entry = PendingChange & { value: DraftValue; baseline: DraftValue }

type DraftContextValue = {
  changes: PendingChange[]
  /** The draft value for a field, or undefined if it hasn't been touched. */
  get: (key: string) => DraftValue | undefined
  set: (
    key: string,
    value: DraftValue,
    baseline: DraftValue,
    meta: { section: string; label: string }
  ) => void
  discardAll: () => void
  publishAll: () => void
}

const DraftContext = React.createContext<DraftContextValue | null>(null)

export function useCompanyDraft() {
  return React.useContext(DraftContext)
}

function same(a: DraftValue, b: DraftValue): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const x = Array.isArray(a) ? a : [a]
    const y = Array.isArray(b) ? b : [b]
    return x.length === y.length && x.every((v, i) => v === y[i])
  }
  return a === b
}

/**
 * Binds one field to the buffer. Returns the value to render — the draft if the
 * field has been edited, otherwise what's stored — and a setter.
 *
 * `stored` is the value from the fixture/DB. It's the baseline a Discard returns
 * to, and it stays the baseline until a Publish adopts the draft.
 */
export function useDraftField(
  key: string,
  stored: DraftValue,
  meta: { section: string; label: string }
) {
  const ctx = useCompanyDraft()
  const draft = ctx?.get(key)
  const value = draft ?? stored
  const { section, label } = meta

  const setValue = React.useCallback(
    (next: DraftValue) => ctx?.set(key, next, stored, { section, label }),
    [ctx, key, stored, section, label]
  )

  return [value, setValue] as const
}

export function CompanyDraftProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = React.useState<Record<string, Entry>>({})

  const get = React.useCallback(
    (key: string) => entries[key]?.value,
    [entries]
  )

  const set = React.useCallback(
    (
      key: string,
      value: DraftValue,
      baseline: DraftValue,
      meta: { section: string; label: string }
    ) => {
      setEntries((prev) => {
        // A field edited back to its baseline stops being a pending change,
        // so "3 changes" never counts an edit that was undone by hand.
        const effectiveBaseline = prev[key]?.baseline ?? baseline
        if (same(value, effectiveBaseline)) {
          if (!(key in prev)) return prev
          const rest = { ...prev }
          delete rest[key]
          return rest
        }
        return {
          ...prev,
          [key]: { key, value, baseline: effectiveBaseline, ...meta },
        }
      })
    },
    []
  )

  const discardAll = React.useCallback(() => setEntries({}), [])

  const publishAll = React.useCallback(() => {
    // A real publish writes these and stamps a version. Here the drafts simply
    // become the new baseline, so republishing doesn't re-offer the same edits.
    setEntries((prev) => {
      const next: Record<string, Entry> = {}
      for (const e of Object.values(prev)) {
        next[e.key] = { ...e, baseline: e.value }
      }
      return next
    })
  }, [])

  const changes = React.useMemo(
    () =>
      Object.values(entries)
        .filter((e) => !same(e.value, e.baseline))
        .map(({ key, section, label, baseline, value }) => ({
          key,
          section,
          label,
          baseline,
          value,
        })),
    [entries]
  )

  const value = React.useMemo(
    () => ({ changes, get, set, discardAll, publishAll }),
    [changes, get, set, discardAll, publishAll]
  )

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
}
