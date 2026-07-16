"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import {
  ExternalLink,
  Mail,
  Phone,
  Globe,
  GraduationCap,
  Sparkles,
  Eye,
  ChevronDown,
  Bookmark,
  Building2,
} from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { TierBadge } from "@/components/tier-badge"
import { GithubIcon, LinkedinIcon } from "@/components/icons/brand-icons"
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

function isGithubUrl(url: string): boolean {
  try {
    return new URL(url).hostname.includes("github.com")
  } catch {
    return false
  }
}

function IconLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      aria-label={label}
      className="text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
    </a>
  )
}

export function CandidateCard({ candidate }: { candidate: CandidateRow }) {
  // Shortlist is presentational only for now — there's no persisted
  // shortlist field/table in the schema yet, so this resets on reload.
  const [shortlisted, setShortlisted] = React.useState(false)

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
          <IconLink
            href={`/candidates/${candidate.candidate_id}`}
            label="Open profile in new tab"
          >
            <ExternalLink className="size-3.5" />
          </IconLink>
          {candidate.linkedin_url && (
            <IconLink href={candidate.linkedin_url} label="LinkedIn">
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
              <IconLink href={candidate.portfolio_url} label="GitHub">
                <GithubIcon className="size-3.5" />
              </IconLink>
            ) : (
              <IconLink href={candidate.portfolio_url} label="Portfolio">
                <Globe className="size-3.5" />
              </IconLink>
            ))}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant={shortlisted ? "secondary" : "outline"}
            size="sm"
            className="gap-1"
            onClick={() => setShortlisted((v) => !v)}
          >
            <Bookmark className={shortlisted ? "fill-current" : undefined} />
            {shortlisted ? "Shortlisted" : "Shortlist"}
            <ChevronDown className="size-3" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Preview">
            <Eye />
          </Button>
        </div>
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
