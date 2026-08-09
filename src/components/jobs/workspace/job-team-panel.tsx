"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarDays, Check, Send, Users } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { STARTER_ROLES } from "@/components/jobs/draft/steps/team-member-data"
import {
  TeamMemberCalendarSheet,
  type CalendarSheetState,
} from "@/components/jobs/workspace/team-member-calendar-sheet"
import {
  addJobTeamMember,
  getTeamMemberCalendar,
  resendCalendarConnectInvite,
} from "@/app/(app)/jobs/actions"

export type JobTeamMemberItem = {
  id: string
  name: string
  email: string
  role: string
  connected: boolean
}

/** How long the Resend button stays disabled after a successful send. */
const RESEND_COOLDOWN_MS = 60_000

/**
 * Add a hiring-team member to an already-published job. Each add fires a
 * "connect your Google Calendar" invite (no-op if that email is already
 * connected — see sendCalendarConnectInvite), and anyone still showing as
 * not-connected can be re-invited from here. Status is a plain connected/
 * not-connected badge, checked live — no richer state machine, and the resend
 * cooldown is client-side only (nothing is persisted per send).
 */
export function JobTeamPanel({
  jobId,
  members,
}: {
  jobId: string
  members: JobTeamMemberItem[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState("")
  const [adding, setAdding] = React.useState(false)
  const [resendingId, setResendingId] = React.useState<string | null>(null)
  const [recentlySent, setRecentlySent] = React.useState<string[]>([])
  const [calendar, setCalendar] = React.useState<CalendarSheetState | null>(null)
  const calendarRequestId = React.useRef(0)

  /**
   * Opening a calendar closes this dialog — the sheet replaces it rather than
   * stacking on top of it, so the week grid gets the full screen. `openedAt` is
   * captured by the click handler so the sheet stays anchored to one instant
   * across re-renders (and so nothing impure runs during render).
   */
  async function openCalendar(member: JobTeamMemberItem, openedAt: number) {
    setOpen(false)
    const target = { id: member.id, name: `${member.name}'s calendar` }
    setCalendar({ target, loading: true, error: null, busy: null, openedAt })

    const requestId = ++calendarRequestId.current
    const res = await getTeamMemberCalendar(member.id)
    if (requestId !== calendarRequestId.current) return // superseded by a later open

    setCalendar((prev) =>
      prev === null
        ? null // closed while loading
        : {
            ...prev,
            loading: false,
            error: !res.ok ? res.error : res.preview.ok ? null : res.preview.error,
            busy: res.ok && res.preview.ok ? res.preview.busy : null,
          },
    )
  }

  const canAdd = name.trim() !== "" && email.trim() !== "" && role.trim() !== ""

  async function resend(member: JobTeamMemberItem) {
    setResendingId(member.id)
    const res = await resendCalendarConnectInvite(member.id)
    setResendingId(null)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(`Invite resent to ${member.email}.`)
    setRecentlySent((prev) => [...prev, member.id])
    setTimeout(
      () => setRecentlySent((prev) => prev.filter((id) => id !== member.id)),
      RESEND_COOLDOWN_MS,
    )
  }

  async function add() {
    if (!canAdd) return
    setAdding(true)
    const res = await addJobTeamMember(jobId, {
      name: name.trim(),
      email: email.trim(),
      role,
    })
    setAdding(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(`${name.trim()} was added — a calendar connect invite was sent.`)
    setName("")
    setEmail("")
    setRole("")
    router.refresh()
  }

  // Connection status is computed server-side at page render, but people
  // connect in a separate tab (Google's redirect) — which never revalidates
  // this page. Re-fetch on open so the badges reflect reality rather than
  // whenever the job page last rendered.
  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) router.refresh()
  }

  return (
    <>
      <TeamMemberCalendarSheet state={calendar} onClose={() => setCalendar(null)} />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger
          render={
            <Button variant="outline" className="gap-1.5">
              <Users className="size-4" />
              Team
            </Button>
          }
        />
        <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Hiring team</DialogTitle>
            <DialogDescription>
              Everyone added here gets a &ldquo;connect your Google Calendar&rdquo; invite
              so Stellaforce can help schedule their interviews.
            </DialogDescription>
          </DialogHeader>

          <TooltipProvider>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {members.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No team members yet.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {members.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{m.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.email}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge variant="outline">{m.role}</Badge>
                        <Badge variant={m.connected ? "default" : "secondary"}>
                          {m.connected ? "Connected" : "Not connected"}
                        </Badge>
                        {m.connected ? (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`View ${m.name}'s availability`}
                                  onClick={() => openCalendar(m, Date.now())}
                                >
                                  <CalendarDays />
                                </Button>
                              }
                            />
                            <TooltipContent>View availability</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Resend calendar invite to ${m.name}`}
                                  disabled={
                                    resendingId === m.id || recentlySent.includes(m.id)
                                  }
                                  onClick={() => resend(m)}
                                >
                                  {recentlySent.includes(m.id) ? (
                                    <Check />
                                  ) : (
                                    <Send
                                      className={
                                        resendingId === m.id ? "animate-pulse" : undefined
                                      }
                                    />
                                  )}
                                </Button>
                              }
                            />
                            <TooltipContent>
                              {recentlySent.includes(m.id)
                                ? "Invite sent"
                                : "Resend calendar invite"}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TooltipProvider>

          <div className="flex shrink-0 flex-col gap-3 border-t border-border pt-4">
            <Label className="text-xs font-semibold text-muted-foreground">
              Add a team member
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
              />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
              />
              <Select value={role} onValueChange={(value) => setRole(value as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  {STARTER_ROLES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button disabled={!canAdd || adding} onClick={add} className="self-end">
              {adding ? "Adding…" : "Add"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
