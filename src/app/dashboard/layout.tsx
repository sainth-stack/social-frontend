"use client";

import PortalLayout from "@/components/layouts/PortalLayout";
import { dashboardNavSections, filterNavSections } from "@/components/layouts/nav-config";
import { selectUser } from "@/features/auth/authSlice";
import { useAppSelector } from "@/store/hooks";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = useAppSelector(selectUser);

  return (
    <PortalLayout
      navSections={filterNavSections(dashboardNavSections, user)}
      brand={{
        type: "organization",
        name: user?.workspaceName ?? "Workspace",
        logoUrl: user?.workspaceLogoUrl,
      }}
    >
      {children}
    </PortalLayout>
  );
}
