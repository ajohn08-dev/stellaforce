import { cn } from "@/lib/utils"

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "text-brand-purple-700 dark:text-brand-purple-300",
        className
      )}
    >
      Stellaforce
    </span>
  )
}
