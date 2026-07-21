import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { BreadcrumbProvider } from "@/lib/breadcrumb-context";
import { SidebarProvider } from "@/lib/sidebar-context";
import { getCurrentProfile } from "@/lib/auth";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getCurrentProfile();

  return (
    <SidebarProvider>
      <BreadcrumbProvider>
        <div className="flex h-full">
          <AppSidebar />
          <div
            id="app-content"
            className="flex min-w-0 flex-1 flex-col"
            // Establishes a containing block for descendant `position: fixed`
            // elements (e.g. the candidate-profile Sheet's overlay/panel), so
            // they're scoped to the header+content region instead of the
            // whole viewport — keeping the sidebar out from under the dimmed
            // backdrop.
            style={{ contain: "layout" }}
          >
            <AppHeader user={profile} />
            <main className="flex-1 overflow-y-auto bg-brand-neutral-50">{children}</main>
          </div>
        </div>
      </BreadcrumbProvider>
    </SidebarProvider>
  );
}
