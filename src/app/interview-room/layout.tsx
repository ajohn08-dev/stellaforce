/**
 * The interview room deliberately sits **outside** the `(app)` route group: it
 * is a full-viewport, single-purpose surface with no sidebar, header, or
 * breadcrumbs. `src/proxy.ts` matches every path, so it is still behind auth.
 *
 * When the production candidate flow lands (a real applicant arriving with an
 * emailed session code), it becomes a sibling route under this same shell — at
 * which point that route, not this layout, is what needs a proxy exemption.
 */
export default function InterviewRoomLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="h-full bg-brand-neutral-950 text-white">{children}</div>
}
