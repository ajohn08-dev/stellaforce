import Image from "next/image"
import { Building2 } from "lucide-react"

import { companyLogoSrc } from "@/lib/company-logos"
import { formatDateRange, type WorkHistoryEntry } from "@/lib/work-history"
import { SkillToolChips } from "@/components/skill-tool-chips"

export function ExperienceEntry({
  entry,
  skills,
  tools,
}: {
  entry: WorkHistoryEntry
  /** Skills/tools surfaced from the resume for this role, if any. */
  skills?: string[]
  tools?: string[]
}) {
  const logoSrc = companyLogoSrc(entry.company)
  return (
    <div className="flex gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border">
        {logoSrc ? (
          <Image
            src={logoSrc}
            alt=""
            width={24}
            height={24}
            className="object-contain"
          />
        ) : (
          <Building2 className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{entry.title}</p>
            <p className="text-sm text-muted-foreground">{entry.company}</p>
          </div>
          <p className="shrink-0 text-xs text-muted-foreground">
            {formatDateRange(entry)}
          </p>
        </div>
        {entry.location && (
          <p className="text-xs text-muted-foreground">{entry.location}</p>
        )}
        {entry.description && <p className="mt-1 text-sm">{entry.description}</p>}
        {(skills?.length || tools?.length) && (
          <SkillToolChips skills={skills ?? []} tools={tools ?? []} />
        )}
      </div>
    </div>
  )
}
