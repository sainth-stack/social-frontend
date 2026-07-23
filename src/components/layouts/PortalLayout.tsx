"use client";

import { Box } from "@mui/material";

import Sidebar, { type SidebarBrand } from "@/components/layouts/Sidebar";
import Topbar from "@/components/layouts/Topbar";
import type { NavSection } from "@/components/layouts/nav-config";
import AuthGuard from "@/features/auth/AuthGuard";
import {
  selectMobileSidebarOpen,
  selectSidebarOpen,
  setMobileSidebarOpen,
  toggleSidebar,
} from "@/features/ui/uiSlice";
import { layoutTokens } from "@/lib/theme";
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
  const sidebarExpanded = useAppSelector(selectSidebarOpen);
  const sidebarCollapsed = !sidebarExpanded;

  return (
    <AuthGuard requirePlatformAdmin={requirePlatformAdmin}>
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          display: { md: "flex" },
        }}
      >
        <Sidebar
          sections={navSections}
          brand={brand}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => dispatch(toggleSidebar())}
          mobileOpen={mobileOpen}
          onMobileClose={() => dispatch(setMobileSidebarOpen(false))}
        />
        <Box
          sx={{
            flex: { md: 1 },
            minWidth: 0,
            width: { xs: "100%", md: "auto" },
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Topbar onMenuClick={() => dispatch(setMobileSidebarOpen(true))} />
          <Box
            component="main"
            sx={{
              flex: 1,
              width: "100%",
              boxSizing: "border-box",
              px: layoutTokens.contentPadding,
              py: { xs: 2, md: 3 },
              minHeight: { xs: `calc(100vh - ${layoutTokens.topbarHeight}px)`, md: "auto" },
            }}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </AuthGuard>
  );
}
