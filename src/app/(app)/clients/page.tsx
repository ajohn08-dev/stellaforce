import { redirect } from "next/navigation"

/**
 * `/clients` became `/companies` — the page stopped being a reference list and
 * became a knowledge workspace (see COMPANY.md). Kept as a redirect so existing
 * links and bookmarks survive.
 */
export default function ClientsPage() {
  redirect("/companies")
}
