import Link from "next/link"
import { CircleSlash, PauseCircle, Zap } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ScopeSwitch } from "@/lib/automation-scope-state"

/**
 * Says that automations aren't running, and where that was decided.
 *
 * **Amber, never red.** Red in this product means "something is wrong right
 * now"; an account switched off is working exactly as configured. Spending red
 * on an intended state is how red stops being read.
 *
 * Two shapes from one component so the wording can't drift between the header
 * indicator a recruiter sees on every page and the banner on the page that
 * explains it.
 */

const AMBER = "border-amber-300 bg-amber-50 text-amber-900"

/**
 * The automations bolt, greyed out, beside the notifications bell.
 *
 * It borrows `/automations`' own icon on purpose — the thing that isn't running
 * is named by the symbol already used for it, so nobody has to learn a second
 * one. Only rendered when automations are stopped: a permanent icon that is
 * lit-on-normal is chrome people stop seeing, and the point is to be noticed
 * exactly when something is unusual.
 *
 * **`aria-disabled`, not `disabled`.** A real `disabled` button sets
 * `pointer-events: none`, which swallows hover — so the tooltip that is the
 * entire purpose of the icon would never open. This keeps the muted look and
 * the hover, and still navigates to where the switch can be changed, because an
 * indicator you can't act on just makes people hunt.
 */
export function AutomationsOffPill({ sw }: { sw: ScopeSwitch | null }) {
  if (!sw) return null
  const paused = sw.state === "paused"
  const resumes =
    sw.resumeAt &&
    new Date(sw.resumeAt).toLocaleDateString(undefined, { day: "numeric", month: "long" })

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-disabled
              aria-label={`Automations ${paused ? "paused" : "off"}`}
              className="text-muted-foreground/40 hover:text-muted-foreground/60"
              render={<Link href="/settings/platform" />}
            >
              <Zap />
            </Button>
          }
        />
        <TooltipContent className="max-w-64 text-center">
          Automations are {paused ? "paused" : "off"} for {sw.source.label}
          {resumes ? ` until ${resumes}` : ""}. Nothing is sent automatically.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function AutomationsOffBanner({
  sw,
  scopeNote,
}: {
  sw: ScopeSwitch | null
  /** What this particular screen is showing, when that needs saying. */
  scopeNote?: string
}) {
  if (!sw) return null
  const Icon = sw.state === "paused" ? PauseCircle : CircleSlash
  const resumes =
    sw.resumeAt &&
    new Date(sw.resumeAt).toLocaleDateString(undefined, { day: "numeric", month: "long" })

  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5", AMBER)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          Automations are {sw.state === "paused" ? "paused" : "off"} · {sw.source.label}
          {resumes && <> until {resumes}</>}
        </p>
        <p className="mt-0.5">
          Nothing here runs on its own, and nothing is sent to candidates or the
          hiring team. Stage moves are still recorded, and each job shows the
          action it would have taken so you can do it yourself.
          {scopeNote && <> {scopeNote}</>}{" "}
          <Link href="/settings/platform" className="font-medium underline underline-offset-2">
            Change this
          </Link>
        </p>
      </div>
    </div>
  )
}
