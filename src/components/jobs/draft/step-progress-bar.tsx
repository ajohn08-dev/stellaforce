import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export type Step = { key: string; label: string }

export function StepProgressBar({
  steps,
  currentIndex,
  onStepClick,
}: {
  steps: Step[]
  currentIndex: number
  onStepClick?: (index: number) => void
}) {
  return (
    <ol className="flex items-center">
      {steps.map((step, i) => {
        const isComplete = i < currentIndex
        const isCurrent = i === currentIndex
        const clickable = Boolean(onStepClick) && i <= currentIndex

        return (
          <li key={step.key} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(i)}
              className={cn(
                "flex items-center gap-2",
                clickable ? "cursor-pointer" : "cursor-default"
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  isComplete
                    ? "bg-brand-purple-600 text-white"
                    : isCurrent
                      ? "border-2 border-brand-purple-600 text-brand-purple-600"
                      : "border border-border text-muted-foreground"
                )}
              >
                {isComplete ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-sm whitespace-nowrap",
                  isCurrent
                    ? "font-medium text-foreground"
                    : isComplete
                      ? "text-foreground"
                      : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </button>

            {i < steps.length - 1 && (
              <span
                className={cn(
                  "mx-3 h-px flex-1",
                  isComplete ? "bg-brand-purple-600" : "bg-border"
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
