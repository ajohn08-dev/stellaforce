"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Play, Video } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { triggerAgentTestCall } from "@/app/(app)/agents/actions"

type Channel = "phone" | "room"

/**
 * Test run for a screening agent, over either channel a stage can use.
 *
 * The choice is per *test run*, not per agent: an ElevenLabs conversational
 * agent is channel-agnostic — whether a real stage reaches a candidate by phone
 * or in a browser room is `job_workflow_sub_stages.format` — so any agent can
 * be exercised both ways from here.
 *
 * Phone runs place a real outbound call via n8n against a dummy "Jane Doe"
 * identity (see `triggerAgentTestCall`). Room runs open the browser interview
 * room, which talks to ElevenLabs directly. Both land in `call_recordings` via
 * the same post-call webhook.
 */
export function TestRunAgentDialog({
  agentId,
  agentName,
}: {
  agentId: string
  agentName: string
}) {
  const [open, setOpen] = React.useState(false)
  const [channel, setChannel] = React.useState<Channel>("phone")
  const [phone, setPhone] = React.useState("")
  const [calling, setCalling] = React.useState(false)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setPhone("")
      setChannel("phone")
    }
  }

  async function handleCall() {
    setCalling(true)
    const res = await triggerAgentTestCall(agentId, phone.trim())
    setCalling(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(`Calling ${phone.trim()} to test "${agentName}".`)
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Test run ${agentName}`}>
            <Play className="size-4" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Test run &ldquo;{agentName}&rdquo;</DialogTitle>
          <DialogDescription>
            Pick how you want to reach this agent for the test.
          </DialogDescription>
        </DialogHeader>

        <div
          role="radiogroup"
          aria-label="Test channel"
          className="grid grid-cols-2 gap-2"
        >
          <ChannelOption
            selected={channel === "phone"}
            onSelect={() => setChannel("phone")}
            icon={<Play className="size-4" />}
            label="Phone call"
            hint="Outbound call"
          />
          <ChannelOption
            selected={channel === "room"}
            onSelect={() => setChannel("room")}
            icon={<Video className="size-4" />}
            label="Interview room"
            hint="In your browser"
          />
        </div>

        {channel === "phone" ? (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="test-call-phone">Phone number</Label>
              <Input
                id="test-call-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+12065551234"
              />
            </div>

            <Button
              disabled={phone.trim() === "" || calling}
              onClick={handleCall}
              className="self-end"
            >
              {calling ? "Calling…" : "Call"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Opens an interview room in a new tab. You&rsquo;ll be asked for camera and
              microphone access, then the agent will interview you directly.
            </p>

            <Button
              render={
                <Link
                  href={`/interview-room/${agentId}`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
              className="self-end"
              onClick={() => handleOpenChange(false)}
            >
              Open room
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ChannelOption({
  selected,
  onSelect,
  icon,
  label,
  hint,
}: {
  selected: boolean
  onSelect: () => void
  icon: React.ReactNode
  label: string
  hint: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted"
      )}
    >
      <span className={cn("flex items-center gap-1.5 text-sm font-medium", selected && "text-primary")}>
        {icon}
        {label}
      </span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  )
}
