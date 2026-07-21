import { Wrench } from "lucide-react"

/** Plain pills for skills, wrench-prefixed pills for tools, shown together. */
export function SkillToolChips({
  skills,
  tools,
}: {
  skills: string[]
  tools: string[]
}) {
  if (skills.length === 0 && tools.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <span
          key={skill}
          className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
        >
          {skill}
        </span>
      ))}
      {tools.map((tool) => (
        <span
          key={tool}
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
        >
          <Wrench className="size-3 text-muted-foreground" />
          {tool}
        </span>
      ))}
    </div>
  )
}
