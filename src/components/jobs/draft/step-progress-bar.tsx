import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export type Step = { key: string; label: string; description?: string }

export function StepProgressBar({
  steps,
  currentIndex,
  onStepClick,
  orientation = "horizontal",
}: {
  steps: Step[]
  currentIndex: number
  onStepClick?: (index: number) => void
  orientation?: "horizontal" | "vertical"
}) {
  const isVertical = orientation === "vertical"

  return (
    <ol className={cn("flex", isVertical ? "flex-col gap-1" : "items-center")}>
      {steps.map((step, i) => {
        const isComplete = i < currentIndex
        const isCurrent = i === currentIndex
        const clickable = Boolean(onStepClick) && i <= currentIndex

        return (
          <li
            key={step.key}
            className={
              isVertical ? "flex" : "flex flex-1 items-center last:flex-none"
            }
          >
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(i)}
              className={cn(
                "flex items-center gap-2",
                isVertical && "w-full rounded-md px-2 py-1.5",
                clickable ? "cursor-pointer" : "cursor-default"
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  isComplete
                    ? "bg-primary text-primary-foreground"
                    : isCurrent
                      ? "border-2 border-primary text-primary"
                      : "border border-border text-muted-foreground"
                )}
              >
                {isComplete ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-sm",
                  isVertical ? "text-left" : "whitespace-nowrap",
                  isCurrent
                    ? "font-medium text-primary"
                    : isComplete
                      ? "text-foreground"
                      : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </button>

            {!isVertical && i < steps.length - 1 && (
              <span
                className={cn(
                  "mx-3 h-px flex-1",
                  isComplete ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
