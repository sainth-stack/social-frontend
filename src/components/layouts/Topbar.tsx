"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import MenuIcon from "@mui/icons-material/Menu";
import {
  AppBar,
  Box,
  Breadcrumbs,
  IconButton,
  Toolbar,
  Typography,
} from "@mui/material";

import UserMenu from "@/components/layouts/UserMenu";
import { getBreadcrumbs, shouldShowTopbarContext } from "@/lib/navigation";
import { colors, layoutTokens } from "@/lib/theme";

type TopbarProps = {
  onMenuClick?: () => void;
};

export default function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const showContext = shouldShowTopbarContext(pathname);
  const breadcrumbs = showContext ? getBreadcrumbs(pathname) : [];

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        color: "text.primary",
        borderBottom: `1px solid ${layoutTokens.borderColor}`,
        height: layoutTokens.topbarHeight,
        justifyContent: "center",
        width: "100%",
      }}
    >
      <Toolbar
        disableGutters
        sx={{
          minHeight: `${layoutTokens.topbarHeight}px !important`,
          px: { xs: 2, md: 3 },
          gap: 2,
        }}
      >
        <IconButton
          onClick={onMenuClick}
          sx={{ display: { md: "none" }, mr: -0.5 }}
          aria-label="Open navigation"
        >
          <MenuIcon fontSize="small" />
        </IconButton>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {showContext && breadcrumbs.length > 0 ? (
            <Breadcrumbs
              aria-label="breadcrumb"
              sx={{
                "& .MuiBreadcrumbs-li": { fontSize: "0.75rem" },
                "& .MuiBreadcrumbs-separator": { mx: 0.5, color: "text.disabled" },
              }}
            >
              {breadcrumbs.map((crumb, index) =>
                crumb.href ? (
                  <Typography
                    key={`${crumb.label}-${index}`}
                    component={Link}
                    href={crumb.href}
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      textDecoration: "none",
                      "&:hover": { color: colors.primary },
                    }}
                  >
                    {crumb.label}
                  </Typography>
                ) : (
                  <Typography key={`${crumb.label}-${index}`} variant="caption" color="text.secondary">
                    {crumb.label}
                  </Typography>
                ),
              )}
            </Breadcrumbs>
          ) : null}
        </Box>

        <UserMenu />
      </Toolbar>
    </AppBar>
  );
}
