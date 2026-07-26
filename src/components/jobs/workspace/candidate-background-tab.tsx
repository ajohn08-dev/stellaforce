import { FileText } from "lucide-react"

import { ExperienceEntry } from "@/components/candidates/profile/experience-entry"
import type { WorkHistoryEntry } from "@/lib/work-history"

type EducationEntry = {
  degree: string
  fieldOfStudy?: string
  institution: string
  endYear: string
}

type CertificationEntry = {
  name: string
  issuer: string
  year: string
}

type WorkExperienceEntry = WorkHistoryEntry & {
  /** Skills/tools surfaced from the resume for this specific role. */
  skills: string[]
  tools: string[]
}

const RESUME_FILE_NAME = "Resume.pdf"

/** Most recent first, matching the real candidate profile page's convention. */
export const CANDIDATE_WORK_HISTORY: WorkExperienceEntry[] = [
  {
    company: "Brightline Software",
    title: "Machine Learning Engineer",
    location: "Chicago, IL",
    start_date: "2023-02",
    end_date: null,
    description:
      "Leads the recommendation systems team; shipped a re-ranking model that lifted engagement 12%.",
    skills: ["Model deployment", "A/B testing"],
    tools: ["PyTorch", "Airflow"],
  },
  {
    company: "PixelForge",
    title: "Data Scientist",
    location: "Austin, TX",
    start_date: "2020-06",
    end_date: "2023-01",
    description: "Built the experimentation platform used across product teams.",
    skills: ["Experimentation design", "Statistical analysis"],
    tools: ["Python", "Snowflake"],
  },
  {
    company: "Northwind Studio",
    title: "Software Engineer",
    location: "Chicago, IL",
    start_date: "2018-08",
    end_date: "2020-05",
    description: "Built internal tooling for the data engineering team's ETL pipelines.",
    skills: ["Data pipelines", "API design"],
    tools: ["Java", "Postgres"],
  },
]

/** Most recent first, matching the real candidate profile page's convention. */
const EDUCATION: EducationEntry[] = [
  {
    degree: "MS",
    fieldOfStudy: "Computer Science",
    institution: "University of Illinois",
    endYear: "2018",
  },
  {
    degree: "BS",
    fieldOfStudy: "Mathematics",
    institution: "Purdue University",
    endYear: "2016",
  },
]

const CERTIFICATIONS: CertificationEntry[] = [
  {
    name: "AWS Certified Machine Learning – Specialty",
    issuer: "Amazon Web Services",
    year: "2022",
  },
  {
    name: "TensorFlow Developer Certificate",
    issuer: "Google",
    year: "2021",
  },
]

/**
 * Seeded mock background for this candidate — UI only, not wired to real
 * resume/education/work-history data yet (the job workspace's candidate
 * type doesn't carry that structure the way the full profile page does).
 */
export function CandidateBackgroundTab() {
  return (
    <div className="space-y-8">
      <section>
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
        >
          <FileText className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{RESUME_FILE_NAME}</p>
            <p className="text-xs text-muted-foreground">View resume</p>
          </div>
        </a>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Experience</h3>
        <div className="space-y-4">
          {CANDIDATE_WORK_HISTORY.map((entry, i) => (
            <ExperienceEntry
              key={i}
              entry={entry}
              skills={entry.skills}
              tools={entry.tools}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Education</h3>
        <div className="space-y-3">
          {EDUCATION.map((entry, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">
                {[entry.degree, entry.fieldOfStudy].filter(Boolean).join(", ")}
              </p>
              <p className="text-sm text-muted-foreground">
                {entry.institution} · {entry.endYear}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          Certifications
        </h3>
        <div className="space-y-2">
          {CERTIFICATIONS.map((c, i) => (
            <p key={i} className="text-sm">
              {[c.name, c.issuer, c.year].filter(Boolean).join(" · ")}
            </p>
          ))}
        </div>
      </section>
    </div>
  )
}
