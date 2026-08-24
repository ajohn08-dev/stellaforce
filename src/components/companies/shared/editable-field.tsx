"use client"

import * as React from "react"
import { Plus, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useDraftField } from "@/components/companies/company-draft-context"
import { useFieldScope } from "@/components/companies/shared/field-scope"

/**
 * Inline-editable field primitives.
 *
 * Each takes an `ariaLabel` (which can be long, because screen readers need the
 * context) and an optional short `label` for the publish review list. Reusing
 * the aria label there produced entries like "What a candidate hears about
 * Health benefits" — accurate, and unreadable once you have eight of them.
 *
 * All of them look like plain text until you focus them — a knowledge base
 * you're reading shouldn't look like a form, but everything in it has to be one
 * click from editable. The border and background appear on hover and focus
 * only.
 *
 * Each registers with the **company-wide** draft buffer, so the header's Publish
 * button counts changes across every section and Discard snaps them all back at
 * once. A field only needs its own key; `FieldScopeProvider` supplies the
 * section, so the review list can name a change "Benefits › Health benefits".
 */

const QUIET_INPUT =
  "border-transparent bg-transparent px-2 shadow-none hover:border-input hover:bg-muted/40 focus-visible:border-ring focus-visible:bg-transparent"

/**
 * Binds a text field to the company draft buffer. There is no local value state
 * — the buffer is the source of truth, so the value survives navigating to
 * another section and back.
 */
function useEditableValue(fieldKey: string, stored: string, label: string) {
  const scope = useFieldScope(label)
  return useDraftField(fieldKey, stored, scope) as readonly [
    string,
    (next: string) => void,
  ]
}

// ---------------------------------------------------------------------------

export function EditableText({
  fieldKey,
  value: initial,
  label,
  placeholder = "Not set",
  className,
  ariaLabel,
}: {
  fieldKey: string
  value: string | null | undefined
  /** Short name for the publish review list. Defaults to `ariaLabel`. */
  label?: string
  placeholder?: string
  className?: string
  ariaLabel: string
}) {
  const [value, setValue] = useEditableValue(fieldKey, initial ?? "", label ?? ariaLabel)

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={cn(QUIET_INPUT, "-mx-2 h-7", className)}
    />
  )
}

export function EditableTextarea({
  fieldKey,
  value: initial,
  label,
  placeholder = "Nothing written yet",
  rows,
  className,
  ariaLabel,
}: {
  fieldKey: string
  value: string | null | undefined
  /** Short name for the publish review list. Defaults to `ariaLabel`. */
  label?: string
  placeholder?: string
  rows?: number
  className?: string
  ariaLabel: string
}) {
  const [value, setValue] = useEditableValue(fieldKey, initial ?? "", label ?? ariaLabel)

  return (
    <Textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      rows={rows ?? Math.min(10, Math.max(2, Math.ceil((value.length || 1) / 90)))}
      className={cn(QUIET_INPUT, "-mx-2 resize-y", className)}
    />
  )
}

export function EditableSelect({
  fieldKey,
  value: initial,
  options,
  placeholder = "Not set",
  className,
  ariaLabel,
}: {
  fieldKey: string
  value: string | null | undefined
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
  ariaLabel: string
}) {
  const [value, setValue] = useEditableValue(fieldKey, initial ?? "", ariaLabel)

  return (
    <Select
      value={value || null}
      onValueChange={(next) => setValue((next as string) ?? "")}
    >
      <SelectTrigger
        size="sm"
        aria-label={ariaLabel}
        className={cn(
          "-mx-2 h-7 border-transparent bg-transparent shadow-none hover:border-input hover:bg-muted/40",
          className
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * A list of short values as removable pills with an inline add box — office
 * locations, product categories, customer types, question variants.
 */
export function EditablePills({
  fieldKey,
  values: initial,
  addLabel = "Add",
  ariaLabel,
  className,
}: {
  fieldKey: string
  values: string[]
  addLabel?: string
  ariaLabel: string
  className?: string
}) {
  const scope = useFieldScope(ariaLabel)
  const [values, setValues] = useDraftField(fieldKey, initial, scope) as readonly [
    string[],
    (next: string[]) => void,
  ]
  const [adding, setAdding] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  function commit() {
    const v = draft.trim()
    if (v && !values.includes(v)) setValues([...values, v])
    setDraft("")
    setAdding(false)
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} role="group" aria-label={ariaLabel}>
      {values.map((v) => (
        <span
          key={v}
          className="group inline-flex items-center gap-1 rounded-md bg-muted py-0.5 pr-1 pl-2 text-xs"
        >
          {v}
          <button
            type="button"
            aria-label={`Remove ${v}`}
            onClick={() => setValues(values.filter((x) => x !== v))}
            className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}

      {adding ? (
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commit()
            }
            if (e.key === "Escape") {
              setDraft("")
              setAdding(false)
            }
          }}
          aria-label={`${addLabel} — new value`}
          className="h-6 w-32 px-1.5 text-xs"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <Plus className="size-3" />
          {addLabel}
        </button>
      )}
    </div>
  )
}

/**
 * A labelled row inside a field card. Label left, editable control right, so a
 * whole section scans as a definition list even though every value is live.
 */
export function FieldRow({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className="grid gap-1 px-4 py-2 sm:grid-cols-[13rem_minmax(0,1fr)] sm:items-center sm:gap-4">
      <div className="text-sm text-muted-foreground">
        {label}
        {hint && <p className="text-xs opacity-80">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
