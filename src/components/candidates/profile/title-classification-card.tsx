"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { setCandidateTitleClassification } from "@/app/(app)/candidates/[id]/actions"
import { REVIEW_REASON_LABELS, type ReviewReason } from "@/lib/candidate-readiness"
import type { CandidateCanonicalRole } from "@/lib/data"
import type {
  CandidateRow,
  CandidateSearchStateRow,
  RoleFamily,
  TitleSeniority,
} from "@/lib/supabase/types"

/**
 * Search classification — the candidate-level normalized title, and the one
 * place a recruiter can correct it.
 *
 * Rendered only for Stellaforce-side staff (the page decides; the Server Action
 * re-checks). It is deliberately not general candidate editing: these four
 * fields are what search will filter on, and nothing else on the profile is
 * editable here.
 *
 * The raw title is shown above, plainly labelled and never editable from this
 * card, because the whole point of the feature is that the classification sits
 * *beside* the recruiter's words rather than replacing them.
 */

const NONE = "__none__"

const ROLE_FAMILIES: ReadonlyArray<readonly [RoleFamily, string]> = [
  ["sales", "Sales"],
  ["customer_success", "Customer Success"],
  ["marketing", "Marketing"],
  ["product", "Product"],
  ["design", "Design"],
  ["engineering", "Engineering"],
  ["operations", "Operations"],
]

const SENIORITIES: ReadonlyArray<readonly [TitleSeniority, string]> = [
  ["intern", "Intern"],
  ["entry", "Entry"],
  ["mid", "Mid"],
  ["senior", "Senior"],
  ["staff", "Staff"],
  ["principal", "Principal"],
  ["manager", "Manager"],
  ["director", "Director"],
  ["vp", "VP"],
  ["c_level", "C-level"],
]

const familyLabel = (value: RoleFamily | null) =>
  ROLE_FAMILIES.find(([v]) => v === value)?.[1] ?? null
const seniorityLabel = (value: TitleSeniority | null) =>
  SENIORITIES.find(([v]) => v === value)?.[1] ?? null

/** "Matched automatically · high confidence" / "Set by a recruiter". */
function provenance(candidate: CandidateRow): string {
  const { title_normalization_source: source, title_normalization_confidence: confidence } =
    candidate

  if (source === "recruiter") return "Set by a recruiter"
  if (source === "rule") {
    return confidence === "medium"
      ? "Matched automatically from the title — worth a check"
      : "Matched automatically from the title"
  }
  // No source but a recorded title means the rules ran and matched nothing —
  // a different thing from never having looked, and worth saying so.
  return candidate.normalized_from_title
    ? "No rule matched this title"
    : "Not classified yet"
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={value ? "text-sm font-medium" : "text-sm text-muted-foreground"}>
        {value ?? "—"}
      </span>
    </div>
  )
}

export function TitleClassificationCard({
  candidate,
  canonicalRole,
  roles,
  searchState = null,
}: {
  candidate: CandidateRow
  canonicalRole: CandidateCanonicalRole | null
  roles: CandidateCanonicalRole[]
  searchState?: CandidateSearchStateRow | null
}) {
  const [editing, setEditing] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const [roleId, setRoleId] = React.useState<string | null>(candidate.canonical_role_id)
  const [family, setFamily] = React.useState<RoleFamily | null>(candidate.role_family)
  const [seniority, setSeniority] = React.useState<TitleSeniority | null>(candidate.seniority)

  // Reset the draft whenever the card reopens, so a cancelled edit never leaks
  // into the next one.
  function open() {
    setRoleId(candidate.canonical_role_id)
    setFamily(candidate.role_family)
    setSeniority(candidate.seniority)
    setEditing(true)
  }

  const selectedRole = roles.find((r) => r.id === roleId) ?? null

  /**
   * Picking a role decides the family — they cannot disagree, and the server
   * refuses a pair that does. So the family control follows the role rather
   * than offering a second, contradictable answer.
   */
  function chooseRole(next: string | null) {
    setRoleId(next)
    const role = roles.find((r) => r.id === next)
    if (role) setFamily(role.role_family)
  }

  /** Changing the family drops a role that no longer belongs to it. */
  function chooseFamily(next: RoleFamily | null) {
    setFamily(next)
    if (selectedRole && selectedRole.role_family !== next) setRoleId(null)
  }

  function save() {
    startTransition(async () => {
      const result = await setCandidateTitleClassification({
        candidateId: candidate.candidate_id,
        canonicalRoleId: roleId,
        roleFamily: family,
        seniority,
      })
      if (result.ok) {
        setEditing(false)
        toast.success("Search classification updated.")
      } else {
        toast.error(result.error)
      }
    })
  }

  const rolesForFamily = family ? roles.filter((r) => r.role_family === family) : roles

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Search classification</h2>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={open}>
            Edit
          </Button>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        {/* The recruiter's own words, first and unedited. */}
        <Row label="Current title (as written)" value={candidate.current_title} />

        <div className="border-t border-border pt-3">
          {editing ? (
            <div className="space-y-3">
              <div className="grid gap-1.5">
                <Label>Role family</Label>
                <Select
                  value={family ?? NONE}
                  onValueChange={(v) =>
                    chooseFamily(v === NONE ? null : (v as RoleFamily))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unclassified</SelectItem>
                    {ROLE_FAMILIES.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label>Canonical role</Label>
                <Select
                  value={roleId ?? NONE}
                  onValueChange={(v) => chooseRole(v === NONE ? null : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unclassified</SelectItem>
                    {rolesForFamily.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label>Seniority</Label>
                <Select
                  value={seniority ?? NONE}
                  onValueChange={(v) =>
                    setSeniority(v === NONE ? null : (v as TitleSeniority))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None stated</SelectItem>
                    {SENIORITIES.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-muted-foreground">
                Saving marks this as recruiter-set, so a later résumé upload
                won&apos;t overwrite it.
              </p>

              <div className="flex items-center gap-2">
                <Button size="sm" onClick={save} disabled={pending}>
                  {pending ? "Saving…" : "Save classification"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Row label="Canonical role" value={canonicalRole?.label ?? null} />
              <Row
                label="Role family"
                value={familyLabel(canonicalRole?.role_family ?? candidate.role_family)}
              />
              <Row label="Seniority" value={seniorityLabel(candidate.seniority)} />
              <p className="pt-1 text-xs text-muted-foreground">{provenance(candidate)}</p>
              <SearchStateNote state={searchState} />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * What is still missing for this candidate's search data, in plain words.
 *
 * **Never says they can't be found.** Every candidate is searchable by name,
 * title text, city, skills and years no matter what is listed here; these are
 * the things a recruiter could fix to make them easier to find, and the first
 * one is usually the classification above.
 *
 * `pending` and `failed` are deliberately quiet on this screen. A sweep that
 * has not run yet, or a reconciliation that broke, is our problem and not a
 * fact about this person — it belongs in the operational counts, not on their
 * profile.
 */
function SearchStateNote({ state }: { state: CandidateSearchStateRow | null }) {
  if (!state || state.readiness !== "ready_with_review") return null

  const reasons = state.review_reasons.filter(
    (code): code is ReviewReason => code in REVIEW_REASON_LABELS
  )
  if (reasons.length === 0) return null

  return (
    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2.5">
      <p className="text-xs font-medium text-amber-900">Worth a look</p>
      <ul className="mt-1 space-y-0.5">
        {reasons.map((code) => (
          <li key={code} className="text-xs text-amber-900/90">
            {REVIEW_REASON_LABELS[code]}
          </li>
        ))}
      </ul>
    </div>
  )
}
