import Image from "next/image"
import { Building2 } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Company mark. Falls back to initials over a neutral tile rather than a generic
 * icon whenever there's a name to work with — initials are scannable in a list,
 * a repeated building glyph isn't.
 */
export function CompanyLogo({
  name,
  logoPath,
  size = "default",
  className,
}: {
  name: string
  logoPath?: string | null
  size?: "sm" | "default" | "lg"
  className?: string
}) {
  const dimension = size === "sm" ? 32 : size === "lg" ? 56 : 40

  const box = cn(
    "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted",
    size === "sm" && "size-8",
    size === "default" && "size-10",
    size === "lg" && "size-14",
    className
  )

  if (logoPath) {
    return (
      <span className={box}>
        <Image
          src={logoPath}
          alt=""
          width={dimension}
          height={dimension}
          className="size-full object-contain"
        />
      </span>
    )
  }

  const initials = name
    .split(/\s+/)
    .filter((w) => /[a-z]/i.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("")

  return (
    <span className={box} aria-hidden>
      {initials ? (
        <span
          className={cn(
            "font-semibold text-muted-foreground",
            size === "sm" ? "text-xs" : size === "lg" ? "text-lg" : "text-sm"
          )}
        >
          {initials}
        </span>
      ) : (
        <Building2 className="size-4 text-muted-foreground" />
      )}
    </span>
  )
}
