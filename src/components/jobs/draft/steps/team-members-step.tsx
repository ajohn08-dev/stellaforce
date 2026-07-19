"use client"

import * as React from "react"
import { MoreVertical } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const STARTER_ROLES = ["Hiring Manager", "Interviewer", "HR Manager", "Approver"]

type Member = {
  id: string
  name: string
  email: string
  role: string
}

/**
 * Two stacked blocks: the add-member form, and a table of members added so
 * far. Roles are client-defined (who this person is to the client for this
 * job, not the app's own recruiter/manager/admin roles).
 */
export function TeamMembersStep() {
  const [members, setMembers] = React.useState<Member[]>([])
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState("")

  const canAddMember =
    name.trim() !== "" && email.trim() !== "" && role.trim() !== ""

  function addMember() {
    if (!canAddMember) return
    setMembers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: name.trim(), email: email.trim(), role },
    ])
    setName("")
    setEmail("")
    setRole("")
  }

  function removeMember(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(members.map((m) => m.id)) : new Set())
  }

  const allSelected = members.length > 0 && selectedIds.size === members.length
  const someSelected = selectedIds.size > 0 && !allSelected

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-lg border border-border bg-white p-6">
        <h3 className="text-sm font-semibold text-foreground">New Member</h3>

        <div className="mt-4 grid grid-cols-4 items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jamie Rivera"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. jamie@client.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select role" />
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

          <Button disabled={!canAddMember} onClick={addMember}>
            Save
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-white p-6">
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No team members added yet.
          </p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Checkbox
                      aria-label="Select all members"
                      checked={allSelected}
                      indeterminate={someSelected}
                      onCheckedChange={(checked) =>
                        toggleSelectAll(!!checked)
                      }
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <Checkbox
                        aria-label={`Select ${member.name}`}
                        checked={selectedIds.has(member.id)}
                        onCheckedChange={(checked) =>
                          toggleSelected(member.id, !!checked)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {member.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.email}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                        {member.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Actions for ${member.name}`}
                              className="text-muted-foreground hover:text-foreground"
                            />
                          }
                        >
                          <MoreVertical />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() => removeMember(member.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
