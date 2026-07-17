import { GithubIcon, LinkedinIcon } from "@/components/icons/brand-icons"
import { isGithubUrl } from "@/lib/utils"
import type { CandidateRow, ContactInfo } from "@/lib/supabase/types"

export function ProfileHeader({ candidate }: { candidate: CandidateRow }) {
  const contact = (candidate.contact_info as ContactInfo | null) ?? {}
  const titleAtCompany = [candidate.current_title, candidate.current_company]
    .filter(Boolean)
    .join(" at ")

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {candidate.full_name}
        </h1>
        {candidate.linkedin_url && (
          <a
            href={candidate.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="text-muted-foreground hover:text-foreground"
          >
            <LinkedinIcon className="size-4" />
          </a>
        )}
        {candidate.portfolio_url && isGithubUrl(candidate.portfolio_url) && (
          <a
            href={candidate.portfolio_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="text-muted-foreground hover:text-foreground"
          >
            <GithubIcon className="size-4" />
          </a>
        )}
      </div>
      {titleAtCompany && (
        <p className="text-muted-foreground">{titleAtCompany}</p>
      )}
      {contact.location && (
        <p className="text-sm text-muted-foreground">{contact.location}</p>
      )}
    </div>
  )
}
