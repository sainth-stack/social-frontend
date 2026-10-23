"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LogoutIcon from "@mui/icons-material/Logout";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";

import { logout, selectUser } from "@/features/auth/authSlice";
import { canManageSettings, socialPermissionLabel } from "@/lib/permissions";
import { colors, layoutTokens } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

export default function UserMenu() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const roleLabel = user.isPlatformAdmin
    ? "Platform Admin"
    : socialPermissionLabel(user.socialPermissionLevel);
  const settingsHref = canManageSettings(user) ? "/dashboard/settings" : undefined;

  const handleLogout = () => {
    dispatch(logout());
    setAnchorEl(null);
    router.replace("/login");
  };

  return (
    <>
      <IconButton
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{
          p: 0.25,
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Avatar
          sx={{
            width: 36,
            height: 36,
            bgcolor: colors.primaryLight,
            color: colors.primary,
            fontSize: "0.8125rem",
            fontWeight: 600,
          }}
        >
          {initials}
        </Avatar>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{
          paper: {
            sx: { mt: 1, minWidth: 240, borderRadius: `${layoutTokens.radius}px`, py: 0.5 },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography sx={{ fontWeight: 600, fontSize: "0.875rem" }}>{user.name}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {user.email}
          </Typography>
          {!user.isPlatformAdmin ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {user.workspaceName}
            </Typography>
          ) : null}
          <Box
            sx={{
              mt: 1,
              display: "inline-block",
              px: 1,
              py: 0.25,
              borderRadius: `${layoutTokens.radius}px`,
              bgcolor: colors.primaryLight,
              color: colors.primary,
              fontSize: "0.6875rem",
              fontWeight: 600,
            }}
          >
            {roleLabel}
          </Box>
        </Box>
        <Divider />
        {settingsHref ? (
          <MenuItem
            component={Link}
            href={settingsHref}
            onClick={() => setAnchorEl(null)}
            sx={{ fontSize: "0.875rem", py: 1 }}
          >
            <SettingsOutlinedIcon sx={{ fontSize: 18, mr: 1.5, color: "text.secondary" }} />
            Settings
          </MenuItem>
        ) : null}
        {!user.isPlatformAdmin ? (
          <MenuItem
            component={Link}
            href="/dashboard/billing"
            onClick={() => setAnchorEl(null)}
            sx={{ fontSize: "0.875rem", py: 1 }}
          >
            <CreditCardOutlinedIcon sx={{ fontSize: 18, mr: 1.5, color: "text.secondary" }} />
            Billing
          </MenuItem>
        ) : null}
        <MenuItem onClick={handleLogout} sx={{ fontSize: "0.875rem", py: 1 }}>
          <LogoutIcon sx={{ fontSize: 18, mr: 1.5, color: "text.secondary" }} />
          Sign out
        </MenuItem>
      </Menu>
    </>
  );
}
