import Link from "next/link"
import Image from "next/image"
import { GraduationCap, Sparkles, Building2 } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { TierBadge } from "@/components/tier-badge"
import { CandidateSocialLinks } from "@/components/candidates/candidate-social-links"
import { CandidateActions } from "@/components/candidates/candidate-actions"
import { companyLogoSrc } from "@/lib/company-logos"
import type {
  CandidateRow,
  ContactInfo,
  EducationEntry,
} from "@/lib/supabase/types"

function formatEducation(education: CandidateRow["education"]): string | null {
  const entries = Array.isArray(education) ? (education as EducationEntry[]) : []
  const entry = entries[0]
  if (!entry) return null
  const degreeLine = [entry.degree, entry.field_of_study].filter(Boolean).join(", ")
  if (!degreeLine && !entry.institution) return null
  return [degreeLine, entry.institution && `at ${entry.institution}`]
    .filter(Boolean)
    .join(" ")
}

export function CandidateCard({ candidate }: { candidate: CandidateRow }) {
  const contact = (candidate.contact_info as ContactInfo | null) ?? {}
  const logoSrc = companyLogoSrc(candidate.current_company)
  const education = formatEducation(candidate.education)
  const titleAtCompany = [candidate.current_title, candidate.current_company]
    .filter(Boolean)
    .join(" at ")

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Checkbox aria-label={`Select ${candidate.full_name}`} />
          <Link
            href={`/candidates/${candidate.candidate_id}`}
            className="font-semibold hover:underline"
          >
            {candidate.full_name}
          </Link>
          {candidate.candidate_tier && (
            <TierBadge tier={candidate.candidate_tier} />
          )}
          <CandidateSocialLinks candidate={candidate} />
        </div>

        <CandidateActions candidate={candidate} />
      </div>

      <div className="flex items-center gap-2 text-sm">
        {logoSrc ? (
          <Image
            src={logoSrc}
            alt=""
            width={16}
            height={16}
            className="size-4 shrink-0 object-contain"
          />
        ) : (
          <Building2 className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span>{titleAtCompany || "—"}</span>
        {contact.location && (
          <>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">{contact.location}</span>
          </>
        )}
      </div>

      {education && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GraduationCap className="size-4 shrink-0" />
          <span>{education}</span>
        </div>
      )}

      {candidate.professional_summary && (
        <div className="flex items-start gap-2 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-purple-600" />
          <span className="line-clamp-1">{candidate.professional_summary}</span>
        </div>
      )}
    </div>
  )
}
