import { CompanyDraftProvider } from "@/components/companies/company-draft-context"

/**
 * Hosts the company-wide draft buffer.
 *
 * It lives in the layout, not the page, so unsaved edits survive moving between
 * sections — `?section=` re-renders the page but preserves the layout. That's
 * what lets a recruiter edit the profile, then benefits, then a question, and
 * publish all of it once.
 */
export default function CompanyWorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <CompanyDraftProvider>{children}</CompanyDraftProvider>
}
