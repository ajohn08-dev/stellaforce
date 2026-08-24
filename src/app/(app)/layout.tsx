import { cookies } from "next/headers";

import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { BreadcrumbProvider } from "@/lib/breadcrumb-context";
import { HeaderActionsProvider } from "@/lib/header-actions-context";
import { SidebarProvider } from "@/lib/sidebar-context";
import { SIDEBAR_COOKIE, sidebarCollapsedFromCookie } from "@/lib/sidebar-cookie";
import { ResumeUploadQueueProvider } from "@/lib/resume-upload-queue";
import { getCurrentProfile } from "@/lib/auth";
import { getSwitchableProfiles } from "@/lib/data";
import { IMPERSONATOR_COOKIE } from "@/lib/impersonation";
import { companyAccessFor } from "@/lib/company-access";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getCurrentProfile();
  const canSwitchUsers = profile?.side === "stellaforce" && profile.role === "admin";
  const switchableUsers = canSwitchUsers ? await getSwitchableProfiles() : [];
  const cookieStore = await cookies();
  const isImpersonating = !!cookieStore.get(IMPERSONATOR_COOKIE);
  const sidebarCollapsed = sidebarCollapsedFromCookie(
    cookieStore.get(SIDEBAR_COOKIE)?.value,
  );
  // Client-side profiles get "Company Profile" pointing at their own company
  // instead of the "Companies" list they may not open. Passed as the plain
  // access object, not as resolved nav items — a NavItem carries a lucide icon
  // component, which can't cross into a Client Component.
  const companyAccess = companyAccessFor(profile);

  return (
    <SidebarProvider initialCollapsed={sidebarCollapsed}>
      <BreadcrumbProvider>
        <HeaderActionsProvider>
          <ResumeUploadQueueProvider>
            <div className="flex h-full">
              <AppSidebar companyAccess={companyAccess} />
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
                <AppHeader
                  user={profile}
                  switchableUsers={switchableUsers}
                  isImpersonating={isImpersonating}
                  companyAccess={companyAccess}
                />
                <main className="flex-1 overflow-y-auto bg-brand-neutral-50">{children}</main>
              </div>
            </div>
          </ResumeUploadQueueProvider>
        </HeaderActionsProvider>
      </BreadcrumbProvider>
    </SidebarProvider>
  );
}
