"use client";

import PortalLayout from "@/components/layouts/PortalLayout";
import { adminNavSections } from "@/components/layouts/nav-config";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalLayout navSections={adminNavSections} requirePlatformAdmin brand={{ type: "platform" }}>
      {children}
    </PortalLayout>
  );
}
