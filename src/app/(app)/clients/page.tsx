import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { SupabaseNotice } from "@/components/supabase-notice"
import { getClients } from "@/lib/data"
import { titleCase } from "@/lib/constants"

export default async function ClientsPage() {
  const clients = await getClients()

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground">
          {clients.length} client{clients.length === 1 ? "" : "s"}
        </p>
      </div>

      <SupabaseNotice />

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length ? (
              clients.map((c) => (
                <TableRow key={c.client_id}>
                  <TableCell className="font-medium">
                    {c.client_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{titleCase(c.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-24 text-center text-muted-foreground"
                >
                  No clients yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
