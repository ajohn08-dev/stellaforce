import type { ReactNode } from "react"
import { Mail, Phone, Globe } from "lucide-react"

import { GithubIcon, LinkedinIcon } from "@/components/icons/brand-icons"
import { isGithubUrl } from "@/lib/utils"
import type { CandidateRow, ContactInfo } from "@/lib/supabase/types"

function IconLink({
  href,
  label,
  newTab = false,
  children,
}: {
  href: string
  label: string
  newTab?: boolean
  children: ReactNode
}) {
  return (
    <a
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      aria-label={label}
      className="text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
    </a>
  )
}

/** LinkedIn/email/phone/portfolio icon links + a link to the full profile — shared by grid and list views. */
export function CandidateSocialLinks({ candidate }: { candidate: CandidateRow }) {
  const contact = (candidate.contact_info as ContactInfo | null) ?? {}

  return (
    <div className="flex items-center gap-2">
      {candidate.linkedin_url && (
        <IconLink href={candidate.linkedin_url} label="LinkedIn" newTab>
          <LinkedinIcon className="size-3.5" />
        </IconLink>
      )}
      {contact.email && (
        <IconLink href={`mailto:${contact.email}`} label="Email">
          <Mail className="size-3.5" />
        </IconLink>
      )}
      {contact.phone && (
        <IconLink href={`tel:${contact.phone}`} label="Phone">
          <Phone className="size-3.5" />
        </IconLink>
      )}
      {candidate.portfolio_url &&
        (isGithubUrl(candidate.portfolio_url) ? (
          <IconLink href={candidate.portfolio_url} label="GitHub" newTab>
            <GithubIcon className="size-3.5" />
          </IconLink>
        ) : (
          <IconLink href={candidate.portfolio_url} label="Portfolio" newTab>
            <Globe className="size-3.5" />
          </IconLink>
        ))}
    </div>
  )
}
