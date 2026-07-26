"use client"

import { useSetBreadcrumb } from "@/lib/breadcrumb-context"
import { titleCase } from "@/lib/constants"
import type { WorkflowStatus } from "@/lib/mock-workflows"

/** Registers "Workflows > {name} [status]" as the top-nav breadcrumb while this page is mounted. */
export function SetWorkflowBreadcrumb({
  name,
  status,
}: {
  name: string
  status: WorkflowStatus
}) {
  useSetBreadcrumb([
    { label: "Workflows", href: "/workflows" },
    { label: name, badge: titleCase(status) },
  ])
  return null
}
