import Link from "next/link"
import { Briefcase, Building2, Users } from "lucide-react"

import { getCandidates, getClients, getJobOrders } from "@/lib/data"

export default async function HomePage() {
  const [candidates, jobs, clients] = await Promise.all([
    getCandidates(),
    getJobOrders(),
    getClients(),
  ])

  const stats = [
    {
      href: "/candidates",
      label: "Candidates",
      count: candidates.length,
      icon: Users,
    },
    { href: "/jobs", label: "Jobs", count: jobs.length, icon: Briefcase },
    {
      href: "/clients",
      label: "Clients",
      count: clients.length,
      icon: Building2,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening across your pipeline.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(({ href, label, count, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-lg border border-border p-5 transition-colors hover:bg-muted/50"
          >
            <Icon className="size-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-semibold tracking-tight">{count}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
