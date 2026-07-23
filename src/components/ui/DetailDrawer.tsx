"use client";

import type { ReactNode } from "react";
import CloseIcon from "@mui/icons-material/Close";
import { Box, Drawer, IconButton, Typography } from "@mui/material";

import { colors } from "@/lib/theme";

type DetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: number;
};

/** Right-side read-only detail panel for CRM contacts, companies, etc. */
export default function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 420,
}: DetailDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: "100%", sm: width },
            borderLeft: `1px solid ${colors.border}`,
          },
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
          px: 2.5,
          py: 2,
          borderBottom: `1px solid ${colors.border}`,
          bgcolor: colors.paper,
          position: "sticky",
          top: 0,
          zIndex: 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: "1rem",
              letterSpacing: "-0.01em",
              lineHeight: 1.35,
            }}
          >
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: "0.8125rem" }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Close" sx={{ mt: -0.25 }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
      <Box sx={{ p: 2.5, pb: 4 }}>{children}</Box>
    </Drawer>
  );
}
