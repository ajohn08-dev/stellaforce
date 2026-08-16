"use client"

import * as React from "react"
import { Check, ChevronRight, Zap } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  AUTOMATION_EVENT_GROUPS,
  AUTOMATION_MODES,
  DEFAULT_AUTOMATION_MODE,
  automationModeLabel,
  type AutomationMode,
} from "@/lib/automation-events"

/**
 * Per-job automation settings, as a cascading menu off the job header: each
 * pipeline event opens a submenu to run it automatically, ask first, or leave
 * it off. The current mode sits on the row so the whole posture of the job is
 * readable without opening anything.
 *
 * **UI only** — modes are component state. Nothing is persisted, and no
 * automation actually changes behaviour yet; the event list is shared with the
 * workflow settings Automation tab (src/lib/automation-events.ts) so the two
 * can't drift.
 */
export function JobAutomationMenu() {
  const [modes, setModes] = React.useState<Record<string, AutomationMode>>({})

  function modeFor(eventId: string): AutomationMode {
    return modes[eventId] ?? DEFAULT_AUTOMATION_MODE
  }

  const activeCount = AUTOMATION_EVENT_GROUPS.flatMap((g) => g.events).filter(
    (e) => modeFor(e.id) !== "off"
  ).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" aria-label="Automations">
            <Zap />
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        className="max-h-[70vh] w-80 overflow-y-auto"
      >
        <DropdownMenuLabel className="flex items-baseline justify-between gap-2">
          <span>Automations</span>
          <span className="text-xs font-normal text-muted-foreground">
            {activeCount} on
          </span>
        </DropdownMenuLabel>

        {AUTOMATION_EVENT_GROUPS.map((group, groupIndex) => (
          <React.Fragment key={group.title}>
            {groupIndex > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {group.title}
            </DropdownMenuLabel>

            {group.events.map((event) => {
              const mode = modeFor(event.id)
              return (
                <DropdownMenuSub key={event.id}>
                  <DropdownMenuSubTrigger>
                    <span className="flex-1 truncate">{event.label}</span>
                    <span
                      className={cn(
                        "text-xs",
                        mode === "off" ? "text-muted-foreground/60" : "text-muted-foreground"
                      )}
                    >
                      {automationModeLabel(mode)}
                    </span>
                    <ChevronRight className="text-muted-foreground" />
                  </DropdownMenuSubTrigger>

                  <DropdownMenuSubContent className="w-72">
                    {AUTOMATION_MODES.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        closeOnClick={false}
                        onClick={() =>
                          setModes((prev) => ({ ...prev, [event.id]: option.value }))
                        }
                        className="items-start gap-2"
                      >
                        <Check
                          className={cn(
                            "mt-0.5",
                            mode === option.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="font-medium">{option.label}</span>
                          <span className="text-xs text-wrap text-muted-foreground">
                            {option.description}
                          </span>
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )
            })}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
