import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getAvatarColorClass, getInitials, getInitialsFromParts } from "@/lib/avatar-colors"
import { cn } from "@/lib/utils"

/**
 * Shows the candidate's photo when avatarUrl is set; otherwise falls back to
 * initials (from firstName/lastName when available, else split from name).
 */
export function CandidateAvatar({
  name,
  firstName,
  lastName,
  avatarUrl,
  className,
}: {
  name: string
  firstName?: string | null
  lastName?: string | null
  avatarUrl?: string | null
  className?: string
}) {
  const initials =
    firstName && lastName ? getInitialsFromParts(firstName, lastName) : getInitials(name)

  return (
    <Avatar className={className}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
      <AvatarFallback className={cn("font-medium", getAvatarColorClass(name))}>
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
