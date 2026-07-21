import Link from "next/link"
import Image from "next/image"
import { GraduationCap, Sparkles, Building2 } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { TierBadge } from "@/components/tier-badge"
import { CandidateAvatar } from "@/components/candidate-avatar"
import { CandidateSocialLinks } from "@/components/candidates/candidate-social-links"
import { CandidateActions } from "@/components/candidates/candidate-actions"
import { companyLogoSrc } from "@/lib/company-logos"
import { formatEducationLine } from "@/lib/education"
import type { CandidateListItem } from "@/lib/data"

export function CandidateCard({ candidate }: { candidate: CandidateListItem }) {
  const logoSrc = companyLogoSrc(candidate.currentRole?.company_name)
  const education = formatEducationLine(
    candidate.primaryEducation ? [candidate.primaryEducation] : []
  )
  const titleAtCompany = candidate.currentRole
    ? [candidate.currentRole.title, candidate.currentRole.company_name]
        .filter(Boolean)
        .join(" at ")
    : candidate.headline ?? ""

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Checkbox aria-label={`Select ${candidate.full_name}`} />
          <CandidateAvatar
            name={candidate.full_name ?? ""}
            firstName={candidate.first_name}
            lastName={candidate.last_name}
            avatarUrl={candidate.avatar_url}
            className="size-7"
          />
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
        {candidate.location_raw && (
          <>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">{candidate.location_raw}</span>
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
