import { Badge } from "@/components/ui/badge"
import { TierBadge } from "@/components/tier-badge"
import { titleCase } from "@/lib/constants"
import type { AddedByProfile } from "@/lib/data"
import type { CandidateRow, ContactInfo } from "@/lib/supabase/types"

export function OverviewTab({
  candidate: c,
  addedBy,
}: {
  candidate: CandidateRow
  addedBy: AddedByProfile | null
}) {
  const contact = (c.contact_info as ContactInfo | null) ?? {}

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <TierBadge tier={c.candidate_tier} />
        <Badge variant="outline">{titleCase(c.data_provenance)}</Badge>
        {c.freshness_score != null && (
          <Badge variant="secondary">
            Freshness {Number(c.freshness_score).toFixed(2)}
          </Badge>
        )}
      </div>

      {c.professional_summary && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Summary</h2>
          <p className="text-sm leading-relaxed">{c.professional_summary}</p>
        </section>
      )}

      {c.tier_rationale && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Tier rationale
          </h2>
          <p className="text-sm leading-relaxed">{c.tier_rationale}</p>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-3">
        <Field label="Email" value={contact.email} />
        <Field label="Phone" value={contact.phone} />
        <Field label="Location" value={contact.location} />
        <Field label="Timezone" value={contact.tz} />
        <Field
          label="Experience"
          value={
            c.years_experience != null ? `${c.years_experience} years` : undefined
          }
        />
        <Field label="Source" value={c.source} />
        <Field label="Added by" value={addedBy?.full_name ?? addedBy?.email} />
        <Field
          label="LinkedIn"
          value={c.linkedin_url}
          href={c.linkedin_url ?? undefined}
        />
        <Field
          label="Portfolio"
          value={c.portfolio_url}
          href={c.portfolio_url ?? undefined}
        />
        <Field label="Languages" value={(c.languages ?? []).join(", ")} />
      </section>
    </div>
  )
}

function Field({
  label,
  value,
  href,
}: {
  label: string
  value?: string | null
  href?: string
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      {href && value ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm hover:underline break-all"
        >
          {value}
        </a>
      ) : (
        <div className="text-sm">{value || "—"}</div>
      )}
    </div>
  )
}
