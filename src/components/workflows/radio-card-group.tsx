import { cn } from "@/lib/utils"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

/** A bordered, selectable card group — shared across the workflow-detail tabs (Stages' Setup/Evaluation/Decision, Scheduling Policy, etc). */
export function RadioCardGroup<T extends string>({
  value,
  onValueChange,
  options,
}: {
  value: T
  onValueChange: (value: T) => void
  options: { value: T; label: string; description: string }[]
}) {
  return (
    <RadioGroup value={value} onValueChange={(v) => onValueChange(v as T)} className="gap-3">
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border p-4",
            value === option.value
              ? "border-primary bg-brand-orange-100"
              : "border-border hover:bg-muted/40"
          )}
        >
          <RadioGroupItem value={option.value} className="mt-0.5" />
          <span className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{option.label}</span>
            <span className="text-sm text-muted-foreground">{option.description}</span>
          </span>
        </label>
      ))}
    </RadioGroup>
  )
}
