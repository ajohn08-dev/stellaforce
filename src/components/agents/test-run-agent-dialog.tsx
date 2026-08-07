"use client"

import * as React from "react"
import { toast } from "sonner"
import { Play } from "lucide-react"

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
import { triggerAgentTestCall } from "@/app/(app)/agents/actions"

/**
 * Test run for a screening agent — places a real outbound call (via n8n) to
 * whatever number the recruiter enters, using a dummy "Jane Doe" candidate
 * identity so it's obviously not a real screen. No candidate/job is actually
 * involved; see triggerAgentTestCall for the payload shape.
 */
export function TestRunAgentDialog({ agentName }: { agentName: string }) {
  const [open, setOpen] = React.useState(false)
  const [phone, setPhone] = React.useState("")
  const [calling, setCalling] = React.useState(false)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setPhone("")
  }

  async function handleCall() {
    setCalling(true)
    const res = await triggerAgentTestCall(agentName, phone.trim())
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
            Enter a phone number and the agent will place a test call to it.
          </DialogDescription>
        </DialogHeader>

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

        <Button disabled={phone.trim() === "" || calling} onClick={handleCall} className="self-end">
          {calling ? "Calling…" : "Call"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
