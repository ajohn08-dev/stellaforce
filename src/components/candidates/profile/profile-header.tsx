import { Mail, Phone, Globe } from "lucide-react"

import { GithubIcon, LinkedinIcon } from "@/components/icons/brand-icons"
import { CandidateAvatar } from "@/components/candidate-avatar"
import { ContactPill } from "@/components/contact-pill"
import { isGithubUrl } from "@/lib/utils"
import { mostRecentRole, type WorkHistoryEntry } from "@/lib/work-history"
import type { CandidateRow } from "@/lib/supabase/types"

export function ProfileHeader({
  candidate,
  workHistory,
}: {
  candidate: CandidateRow
  workHistory: WorkHistoryEntry[]
}) {
  const recentRole = mostRecentRole(workHistory)
  const titleAtCompany = recentRole
    ? [recentRole.title, recentRole.company].filter(Boolean).join(" at ")
    : candidate.headline ?? ""

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <CandidateAvatar
          name={candidate.full_name ?? ""}
          firstName={candidate.first_name}
          lastName={candidate.last_name}
          avatarUrl={candidate.avatar_url}
          className="size-14 text-base"
        />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {candidate.full_name}
          </h1>
          {(titleAtCompany || candidate.location_raw) && (
            <p className="text-muted-foreground">
              {titleAtCompany}
              {titleAtCompany && candidate.location_raw && " • "}
              {candidate.location_raw}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {candidate.linkedin_url && (
          <ContactPill
            href={candidate.linkedin_url}
            icon={<LinkedinIcon className="size-3.5" />}
            label="LinkedIn profile"
          />
        )}
        {candidate.email && (
          <ContactPill
            href={`mailto:${candidate.email}`}
            icon={<Mail className="size-3.5" />}
            label={candidate.email}
          />
        )}
        {candidate.phone && (
          <ContactPill
            href={`tel:${candidate.phone}`}
            icon={<Phone className="size-3.5" />}
            label={candidate.phone}
          />
        )}
        {candidate.portfolio_url &&
          (isGithubUrl(candidate.portfolio_url) ? (
            <ContactPill
              href={candidate.portfolio_url}
              icon={<GithubIcon className="size-3.5" />}
              label="GitHub profile"
            />
          ) : (
            <ContactPill
              href={candidate.portfolio_url}
              icon={<Globe className="size-3.5" />}
              label="Portfolio"
            />
          ))}
      </div>
    </div>
  )
}
