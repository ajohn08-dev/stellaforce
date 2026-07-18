"use client"

import * as React from "react"
import { toast } from "sonner"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { titleCase } from "@/lib/constants"
import { JOB_STATUS_OPTIONS } from "@/lib/job-status"
import { MOCK_JOB_CLIENTS } from "@/lib/mock-jobs"

const EMPTY_FORM = {
  title: "",
  openings: "1",
  client_name: "",
  location: "",
  status: "open",
}

/**
 * UI preview only — this is a static array (src/lib/mock-jobs.ts), not the
 * job_orders table, so "Create job" is an honest stub rather than a write.
 */
export function AddJobDialog() {
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY_FORM)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setForm(EMPTY_FORM)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button>Add Job</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a job</DialogTitle>
          <DialogDescription>
            Create a new job order for a client.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 grid gap-1.5">
              <Label>Job title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Senior Full-Stack Engineer"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Openings</Label>
              <Input
                type="number"
                min={0}
                value={form.openings}
                onChange={(e) =>
                  setForm({ ...form, openings: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Client</Label>
            <Select
              value={form.client_name}
              onValueChange={(v) => setForm({ ...form, client_name: v ?? "" })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_JOB_CLIENTS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Location</Label>
              <Input
                value={form.location}
                onChange={(e) =>
                  setForm({ ...form, location: e.target.value })
                }
                placeholder="Remote (US)"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v ?? form.status })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {titleCase(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Button
          disabled={!form.title || !form.client_name}
          onClick={() => {
            toast.info("Not wired up yet — job creation is coming soon.")
            handleOpenChange(false)
          }}
        >
          Create job
        </Button>
      </DialogContent>
    </Dialog>
  )
}
