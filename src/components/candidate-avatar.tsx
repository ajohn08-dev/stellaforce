import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getAvatarColorClass, getInitials } from "@/lib/avatar-colors"
import { cn } from "@/lib/utils"

/** Initials-only avatar — no photo upload exists yet, so this is every candidate's default. */
export function CandidateAvatar({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return (
    <Avatar className={className}>
      <AvatarFallback className={cn("font-medium", getAvatarColorClass(name))}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
