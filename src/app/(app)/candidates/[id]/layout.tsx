/**
 * Route-scoped override: cancels the shared (app)/layout.tsx <main> padding
 * (px-8 py-8) so this page's two-column split can manage its own padding
 * per column instead of stacking main's padding on top of it. -m-8 exactly
 * offsets main's p-8, landing content flush with main's own boundary — not
 * past it. Doesn't affect any other route.
 */
export default function CandidateDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="-m-8">{children}</div>
}
