"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { sendBookingLinkManually } from "@/app/(app)/jobs/actions"
import type { SkippedAction } from "@/lib/server/skipped-actions"

/**
 * The catch-up queue: what didn't happen, and what can still be done about it.
 *
 * Each row is one recorded skip. A row is only actionable while the candidate
 * is still standing where the skip happened — otherwise it stays listed (the
 * fact is still true and worth seeing) but offers nothing, because sending a
 * booking link for a stage someone has left invites them to an interview
 * nobody is expecting.
 */
export function SkippedActionRows({ actions }: { actions: SkippedAction[] }) {
  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm font-medium text-foreground">Nothing has been skipped</p>
        <p className="text-sm text-muted-foreground">
          When an account has automations switched off, anything the platform
          would have done is recorded here.
        </p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {actions.map((action) => (
        <SkippedRow key={action.eventId} action={action} />
      ))}
    </ul>
  )
}

function SkippedRow({ action }: { action: SkippedAction }) {
  const [pending, startTransition] = React.useTransition()
  const [sent, setSent] = React.useState(false)

  const canSend =
    action.stillRelevant && action.applicationId !== null && action.subStageId !== null

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {action.candidateName ?? "A candidate"}
          {action.stageName && (
            <span className="font-normal text-muted-foreground"> · {action.stageName}</span>
          )}
        </p>
        <p className="text-sm text-muted-foreground">{action.message}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {new Date(action.occurredAt).toLocaleString(undefined, {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          })}
          {action.jobId && action.jobTitle && (
            <>
              {" · "}
              <Link href={`/jobs/${action.jobId}`} className="underline underline-offset-2">
                {action.jobTitle}
              </Link>
            </>
          )}
          {!action.stillRelevant && <> · no longer at this stage</>}
        </p>
      </div>

      {canSend && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={pending || sent}
          onClick={() =>
            startTransition(async () => {
              const result = await sendBookingLinkManually(
                action.applicationId!,
                action.subStageId!
              )
              if (!result.ok) {
                toast.error(result.error)
                return
              }
              setSent(true)
              toast.success(`Booking link sent to ${action.candidateName ?? "the candidate"}.`)
            })
          }
        >
          {sent ? "Sent" : pending ? "Sending…" : "Send it now"}
        </Button>
      )}
    </li>
  )
}
