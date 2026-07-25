"use client";

import Sidebar, { type SidebarBrand } from "@/components/layouts/Sidebar";
import Topbar from "@/components/layouts/Topbar";
import type { NavSection } from "@/components/layouts/nav-config";
import AuthGuard from "@/features/auth/AuthGuard";
import {
  selectMobileSidebarOpen,
  setMobileSidebarOpen,
} from "@/features/ui/uiSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

type PortalLayoutProps = {
  children: React.ReactNode;
  navSections: NavSection[];
  requirePlatformAdmin?: boolean;
  brand: SidebarBrand;
};

export default function PortalLayout({
  children,
  navSections,
  requirePlatformAdmin = false,
  brand,
}: PortalLayoutProps) {
  const dispatch = useAppDispatch();
  const mobileOpen = useAppSelector(selectMobileSidebarOpen);
  const isAdmin = brand.type === "platform";

  return (
    <AuthGuard requirePlatformAdmin={requirePlatformAdmin}>
      <div className="min-h-screen bg-background">
        <Sidebar
          sections={navSections}
          brand={brand}
          mobileOpen={mobileOpen}
          onMobileClose={() => dispatch(setMobileSidebarOpen(false))}
        />
        <div className="md:pl-64">
          <Topbar
            isAdmin={isAdmin}
            onMenuClick={() => dispatch(setMobileSidebarOpen(true))}
          />
          <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
