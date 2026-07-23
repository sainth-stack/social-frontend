"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import {
  Box,
  Collapse,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";

import type { NavItem, NavSection } from "@/components/layouts/nav-config";
import { OrgBrand, PlatformLogo } from "@/components/ui/Logo";
import { colors, layoutTokens } from "@/lib/theme";

export type SidebarBrand =
  | { type: "platform" }
  | { type: "organization"; name: string; logoUrl?: string | null };

type SidebarProps = {
  sections: NavSection[];
  brand: SidebarBrand;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin" || href === "/dashboard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isGroupActive(pathname: string, item: NavItem): boolean {
  if (isActive(pathname, item.href)) return true;
  return item.children?.some((child) => isActive(pathname, child.href)) ?? false;
}

function navItemSx(active: boolean, collapsed: boolean, nested = false) {
  return {
    mb: 0.25,
    mx: collapsed ? 0.25 : nested ? 0.5 : 0,
    ml: collapsed ? 0.25 : nested ? 1.5 : 0,
    pl: collapsed ? 0.75 : nested ? 1.75 : 1.25,
    pr: collapsed ? 0.75 : 1.25,
    borderRadius: `${layoutTokens.navRadius}px`,
    minHeight: layoutTokens.navItemHeight,
    justifyContent: collapsed ? "center" : "flex-start",
    color: active ? colors.primary : colors.textSecondary,
    bgcolor: active ? layoutTokens.navActiveBg : "transparent",
    transition: "background-color 0.12s ease, color 0.12s ease, padding 0.2s ease",
    "&.Mui-selected": {
      bgcolor: layoutTokens.navActiveBg,
      color: colors.primary,
      "&:hover": { bgcolor: layoutTokens.navActiveBg },
    },
    "&:hover": {
      bgcolor: active ? layoutTokens.navActiveBg : layoutTokens.navHoverBg,
    },
  };
}

function NavIcon({
  Icon,
  active,
  nested,
  collapsed,
}: {
  Icon: NavItem["icon"];
  active: boolean;
  nested?: boolean;
  collapsed?: boolean;
}) {
  return (
    <ListItemIcon
      sx={{
        minWidth: collapsed ? 0 : nested ? 28 : 32,
        mr: collapsed ? 0 : 0.25,
        justifyContent: "center",
        color: active ? colors.primary : colors.textSecondary,
      }}
    >
      <Icon sx={{ fontSize: nested ? 18 : 20 }} />
    </ListItemIcon>
  );
}

function NavLink({
  item,
  pathname,
  nested = false,
  collapsed = false,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  nested?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  const button = (
    <ListItemButton
      component={Link}
      href={item.href}
      onClick={onNavigate}
      selected={active}
      sx={navItemSx(active, collapsed, nested)}
    >
      <NavIcon Icon={Icon} active={active} nested={nested} collapsed={collapsed} />
      {!collapsed ? (
        <>
          <ListItemText
            primary={
              <Typography
                sx={{
                  fontSize: nested ? "0.8125rem" : "0.875rem",
                  fontWeight: active ? 500 : 400,
                  color: "inherit",
                  lineHeight: 1.4,
                }}
              >
                {item.label}
              </Typography>
            }
          />
          {item.badge ? (
            <Typography
              component="span"
              sx={{
                fontSize: "0.75rem",
                fontWeight: 500,
                color: colors.textSecondary,
              }}
            >
              {item.badge}
            </Typography>
          ) : null}
        </>
      ) : null}
    </ListItemButton>
  );

  if (collapsed) {
    return (
      <Tooltip title={item.label} placement="right" arrow>
        {button}
      </Tooltip>
    );
  }

  return button;
}

function NavGroup({
  item,
  pathname,
  collapsed = false,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const groupActive = isGroupActive(pathname, item);
  const [open, setOpen] = useState(groupActive);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    if (groupActive) setOpen(true);
  }, [groupActive]);

  if (!item.children?.length) {
    return (
      <NavLink
        item={item}
        pathname={pathname}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
    );
  }

  const Icon = item.icon;

  if (collapsed) {
    return (
      <>
        <Tooltip title={item.label} placement="right" arrow>
          <ListItemButton
            onClick={(event) => setMenuAnchor(event.currentTarget)}
            sx={navItemSx(groupActive, collapsed)}
          >
            <NavIcon Icon={Icon} active={groupActive} collapsed={collapsed} />
          </ListItemButton>
        </Tooltip>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
          slotProps={{
            paper: {
              sx: {
                ml: 1,
                minWidth: 180,
                borderRadius: "10px",
                border: `1px solid ${colors.border}`,
                boxShadow: "0 8px 24px rgb(15 23 42 / 0.1)",
              },
            },
          }}
        >
          <Typography
            sx={{
              px: 2,
              py: 1,
              fontSize: "0.6875rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: colors.textMuted,
            }}
          >
            {item.label}
          </Typography>
          {item.children.map((child) => (
            <MenuItem
              key={child.href}
              component={Link}
              href={child.href}
              onClick={() => {
                setMenuAnchor(null);
                onNavigate?.();
              }}
              selected={isActive(pathname, child.href)}
              sx={{
                fontSize: "0.875rem",
                py: 1,
                mx: 0.75,
                borderRadius: "6px",
                "&.Mui-selected": {
                  bgcolor: colors.primaryLight,
                  color: colors.primary,
                  fontWeight: 500,
                },
              }}
            >
              {child.label}
            </MenuItem>
          ))}
        </Menu>
      </>
    );
  }

  return (
    <Box>
      <ListItemButton onClick={() => setOpen((prev) => !prev)} sx={navItemSx(groupActive, collapsed)}>
        <NavIcon Icon={Icon} active={groupActive} />
        <ListItemText
          primary={
            <Typography
              sx={{
                fontSize: "0.875rem",
                fontWeight: groupActive ? 500 : 400,
                color: "inherit",
                lineHeight: 1.4,
              }}
            >
              {item.label}
            </Typography>
          }
        />
        <ExpandMoreIcon
          sx={{
            fontSize: 18,
            color: colors.textSecondary,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        />
      </ListItemButton>
      <Collapse in={open} timeout={200}>
        <Box sx={{ pb: 0.5, pl: 0.5 }}>
          {item.children.map((child) => (
            <NavLink
              key={child.href}
              item={child}
              pathname={pathname}
              nested
              onNavigate={onNavigate}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

function SidebarToggleButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle?: () => void;
}) {
  return (
    <IconButton
      onClick={onToggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      size="small"
      sx={{
        width: 28,
        height: 28,
        flexShrink: 0,
        border: `1px solid ${colors.border}`,
        borderRadius: "6px",
        color: colors.textSecondary,
        bgcolor: colors.paper,
        transition: "all 0.15s ease",
        "&:hover": {
          bgcolor: colors.background,
          color: colors.textPrimary,
          borderColor: colors.borderHover,
        },
      }}
    >
      {collapsed ? (
        <ChevronRightIcon sx={{ fontSize: 18 }} />
      ) : (
        <ChevronLeftIcon sx={{ fontSize: 18 }} />
      )}
    </IconButton>
  );
}

function SidebarContent({
  sections,
  brand,
  collapsed = false,
  onToggleCollapse,
  onNavigate,
}: {
  sections: NavSection[];
  brand: SidebarBrand;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const homeHref = brand.type === "platform" ? "/admin" : "/dashboard";

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: layoutTokens.sidebarBg }}>
      <Box
        sx={{
          px: collapsed ? 1 : 2,
          height: layoutTokens.sidebarBrandHeight,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 1,
          borderBottom: `1px solid ${layoutTokens.borderColor}`,
          flexShrink: 0,
          bgcolor: layoutTokens.sidebarBg,
          position: "relative",
        }}
      >
        <Box
          component={Link}
          href={homeHref}
          onClick={onNavigate}
          sx={{
            display: "flex",
            alignItems: "center",
            minWidth: 0,
            flex: collapsed ? "0 0 auto" : 1,
            textDecoration: "none",
            color: "inherit",
            overflow: "hidden",
          }}
        >
          {brand.type === "platform" ? (
            <PlatformLogo size={28} priority compact={collapsed} />
          ) : (
            <OrgBrand
              name={brand.name}
              logoUrl={brand.logoUrl}
              size={28}
              compact={collapsed}
            />
          )}
        </Box>
        {!collapsed ? <SidebarToggleButton collapsed={collapsed} onToggle={onToggleCollapse} /> : null}
      </Box>

      {collapsed ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 1, borderBottom: `1px solid ${layoutTokens.borderColor}` }}>
          <SidebarToggleButton collapsed={collapsed} onToggle={onToggleCollapse} />
        </Box>
      ) : null}

      <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", py: 1.5, px: collapsed ? 0.5 : 1.25 }}>
        {sections.map((section, sectionIndex) => (
          <Box key={section.title ?? `section-${sectionIndex}`} sx={{ mb: section.title && !collapsed ? 2.5 : 1 }}>
            {section.title && !collapsed ? (
              <Typography
                sx={{
                  px: 1.25,
                  pt: sectionIndex > 0 ? 1 : 0,
                  pb: 0.75,
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: layoutTokens.sectionLabelColor,
                  lineHeight: 1.4,
                }}
              >
                {section.title}
              </Typography>
            ) : null}
            {section.title && collapsed && sectionIndex > 0 ? (
              <Box
                sx={{
                  mx: 1,
                  mb: 1,
                  borderTop: `1px solid ${layoutTokens.borderColor}`,
                }}
              />
            ) : null}
            <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
              {section.items.map((item) => (
                <NavGroup
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </List>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          px: collapsed ? 1 : 2,
          py: 1.5,
          borderTop: `1px solid ${layoutTokens.borderColor}`,
          flexShrink: 0,
          bgcolor: layoutTokens.sidebarBg,
          display: "flex",
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        {collapsed ? (
          <Tooltip title="Help & Support" placement="right" arrow>
            <IconButton
              size="small"
              aria-label="Help & Support"
              sx={{
                color: colors.textSecondary,
                "&:hover": { color: colors.textPrimary, bgcolor: colors.background },
              }}
            >
              <HelpOutlineOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        ) : (
          <Typography
            component="button"
            type="button"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              border: "none",
              background: "none",
              cursor: "pointer",
              p: 0,
              fontSize: "0.8125rem",
              fontWeight: 400,
              color: colors.textSecondary,
              fontFamily: "inherit",
              transition: "color 0.12s ease",
              "&:hover": { color: colors.textPrimary },
            }}
          >
            <HelpOutlineOutlinedIcon sx={{ fontSize: 16 }} />
            Help & Support
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default function Sidebar({
  sections,
  brand,
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const handleNavigate = () => onMobileClose?.();
  const sidebarWidth = collapsed ? layoutTokens.sidebarCollapsedWidth : layoutTokens.sidebarWidth;

  return (
    <>
      <Box
        component="aside"
        sx={{
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          width: sidebarWidth,
          flexShrink: 0,
          borderRight: `1px solid ${layoutTokens.borderColor}`,
          bgcolor: layoutTokens.sidebarBg,
          position: "sticky",
          top: 0,
          alignSelf: "flex-start",
          height: "100vh",
          transition: "width 0.2s ease",
          overflow: "hidden",
        }}
      >
        <SidebarContent
          sections={sections}
          brand={brand}
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
        />
      </Box>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: layoutTokens.sidebarWidth,
            boxSizing: "border-box",
            bgcolor: layoutTokens.sidebarBg,
            borderRight: `1px solid ${layoutTokens.borderColor}`,
          },
        }}
      >
        <SidebarContent sections={sections} brand={brand} onNavigate={handleNavigate} />
      </Drawer>
    </>
  );
}

export function getSidebarOffset(collapsed: boolean): number {
  return collapsed ? layoutTokens.sidebarCollapsedWidth : layoutTokens.sidebarWidth;
}
