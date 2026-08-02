import { cn } from "@/lib/utils"

export type Step = { key: string; label: string; description?: string }

/**
 * Three states per step:
 *  - selected/active → orange (primary)
 *  - has data (in `dataKeys`) → black (foreground) + freely clickable
 *  - no data yet → gray (muted) + not clickable
 * Steps with data can be navigated to directly by clicking.
 */
export function StepProgressBar({
  steps,
  currentIndex,
  dataKeys,
  onStepClick,
  orientation = "horizontal",
}: {
  steps: Step[]
  currentIndex: number
  /** Keys of steps that already have data (rendered black + clickable). */
  dataKeys?: string[]
  onStepClick?: (index: number) => void
  orientation?: "horizontal" | "vertical"
}) {
  const isVertical = orientation === "vertical"
  const hasData = (key: string) =>
    dataKeys ? dataKeys.includes(key) : false

  return (
    <ol className={cn("flex", isVertical ? "flex-col gap-1" : "items-center")}>
      {steps.map((step, i) => {
        const isCurrent = i === currentIndex
        const withData = hasData(step.key)
        const clickable = Boolean(onStepClick) && (isCurrent || withData)

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
                  isCurrent
                    ? "border-2 border-primary text-primary"
                    : withData
                      ? "border border-foreground text-foreground"
                      : "border border-border text-muted-foreground"
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  "text-sm",
                  isVertical ? "text-left" : "whitespace-nowrap",
                  isCurrent
                    ? "font-medium text-primary"
                    : withData
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
                  withData ? "bg-foreground/30" : "bg-border"
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
