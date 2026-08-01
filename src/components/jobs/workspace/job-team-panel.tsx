"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Users } from "lucide-react"

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
import { STARTER_ROLES } from "@/components/jobs/draft/steps/team-member-data"
import { addJobTeamMember } from "@/app/(app)/jobs/actions"

export type JobTeamMemberItem = {
  id: string
  name: string
  email: string
  role: string
  connected: boolean
}

/**
 * Add a hiring-team member to an already-published job. Each add fires a
 * "connect your Google Calendar" invite (no-op if that email is already
 * connected — see sendCalendarConnectInvite). Status is a plain connected/
 * not-connected badge, checked live — no resend button, no richer state
 * machine (kept lightweight per docs/google-calendar-consent-plan.md).
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

  const canAdd = name.trim() !== "" && email.trim() !== "" && role.trim() !== ""

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            Everyone added here gets a &ldquo;connect your Google Calendar&rdquo; invite so
            Stellaforce can help schedule their interviews.
          </DialogDescription>
        </DialogHeader>

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
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant="outline">{m.role}</Badge>
                    <Badge variant={m.connected ? "default" : "secondary"}>
                      {m.connected ? "Connected" : "Not connected"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-border pt-4">
          <Label className="text-xs font-semibold text-muted-foreground">Add a team member</Label>
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
  )
}
