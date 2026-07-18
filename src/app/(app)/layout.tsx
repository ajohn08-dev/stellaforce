import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { BreadcrumbProvider } from "@/lib/breadcrumb-context";
import { getCurrentProfile } from "@/lib/auth";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getCurrentProfile();

  return (
    <BreadcrumbProvider>
      <div className="flex h-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader user={profile} />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </BreadcrumbProvider>
  );
}
