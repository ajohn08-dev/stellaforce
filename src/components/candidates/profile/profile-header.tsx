import { Mail, Phone, Globe } from "lucide-react"

import { GithubIcon, LinkedinIcon } from "@/components/icons/brand-icons"
import { CandidateAvatar } from "@/components/candidate-avatar"
import { ContactPill } from "@/components/contact-pill"
import { isGithubUrl } from "@/lib/utils"
import type { CandidateRow, ContactInfo } from "@/lib/supabase/types"

export function ProfileHeader({ candidate }: { candidate: CandidateRow }) {
  const contact = (candidate.contact_info as ContactInfo | null) ?? {}
  const titleAtCompany = [candidate.current_title, candidate.current_company]
    .filter(Boolean)
    .join(" at ")

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <CandidateAvatar name={candidate.full_name} className="size-14 text-base" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {candidate.full_name}
          </h1>
          {(titleAtCompany || contact.location) && (
            <p className="text-muted-foreground">
              {titleAtCompany}
              {titleAtCompany && contact.location && " • "}
              {contact.location}
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
        {contact.email && (
          <ContactPill
            href={`mailto:${contact.email}`}
            icon={<Mail className="size-3.5" />}
            label={contact.email}
          />
        )}
        {contact.phone && (
          <ContactPill
            href={`tel:${contact.phone}`}
            icon={<Phone className="size-3.5" />}
            label={contact.phone}
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
