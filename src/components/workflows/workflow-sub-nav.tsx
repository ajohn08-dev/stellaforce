"use client"

import { cn } from "@/lib/utils"

/** The left rail inside a workflow-detail tab (AI & Automation, Scheduling Policy). */
export function WorkflowSubNav<T extends string>({
  items,
  value,
  onValueChange,
  className,
}: {
  items: readonly T[]
  value: T
  onValueChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cn("flex w-40 shrink-0 flex-col gap-1", className)}>
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onValueChange(item)}
          className={cn(
            "rounded-md px-3 py-2 text-left text-sm",
            value === item
              ? "bg-brand-orange-100 font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          {item}
        </button>
      ))}
    </div>
  )
}
