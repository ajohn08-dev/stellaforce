export function AnalyticsSection({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      {title && <h2 className="text-sm font-medium text-foreground">{title}</h2>}
      {children}
    </section>
  )
}
