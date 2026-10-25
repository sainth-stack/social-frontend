"use client";

import { useEffect, useState } from "react";
import Sidebar, { type SidebarBrand } from "@/components/layouts/Sidebar";
import Topbar from "@/components/layouts/Topbar";
import MobileNavigation from "@/components/layouts/MobileNavigation";
import type { NavSection } from "@/components/layouts/nav-config";
import AuthGuard from "@/features/auth/AuthGuard";
import {
  selectMobileSidebarOpen,
  setMobileSidebarOpen,
} from "@/features/ui/uiSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { cn } from "@/lib/utils";

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
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { setCollapsed(window.localStorage.getItem("opsbrain-sidebar-collapsed") === "true"); } catch {}
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (media.matches) dispatch(setMobileSidebarOpen(false)); };
    closeOnDesktop();
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, [dispatch]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { window.localStorage.setItem("opsbrain-sidebar-collapsed", String(next)); } catch {}
  };

  return (
    <AuthGuard requirePlatformAdmin={requirePlatformAdmin}>
      <div className="min-h-screen bg-background">
        <a href="#main-content" className="sr-only rounded-md bg-background px-4 py-2 text-sm font-medium text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:outline-none focus:ring-2 focus:ring-ring">Skip to main content</a>
        <Sidebar
          sections={navSections}
          brand={brand}
          mobileOpen={mobileOpen}
          collapsed={collapsed}
          onMobileClose={() => dispatch(setMobileSidebarOpen(false))}
        />
        <div className={cn("min-w-0", collapsed ? "lg:pl-20" : "lg:pl-64")}>
          <Topbar
            isAdmin={isAdmin}
            onMenuClick={() => dispatch(setMobileSidebarOpen(true))}
            onCollapseClick={toggleCollapsed}
            collapsed={collapsed}
            menuOpen={mobileOpen}
          />
          <main id="main-content" tabIndex={-1} className="portal-main min-h-screen min-w-0 p-4 outline-none md:p-8">{children}</main>
        </div>
        <MobileNavigation sections={navSections} isAdmin={isAdmin} menuOpen={mobileOpen} onMenuClick={() => dispatch(setMobileSidebarOpen(true))} />
      </div>
    </AuthGuard>
  );
}
