"use client";

import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

import { colors, surfaceSx } from "@/lib/theme";

type SectionCardProps = {
  title: string;
  description?: string;
  badge?: string;
  children: ReactNode;
  noPadding?: boolean;
};

export default function SectionCard({
  title,
  description,
  badge,
  children,
  noPadding = false,
}: SectionCardProps) {
  return (
    <Box sx={{ ...surfaceSx, borderRadius: "10px", overflow: "hidden" }}>
      <Box
        sx={{
          px: 1.75,
          py: 1.25,
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: colors.textPrimary }}>
            {title}
          </Typography>
          {description && (
            <Typography sx={{ fontSize: "0.6875rem", color: colors.textMuted, mt: 0.25 }}>
              {description}
            </Typography>
          )}
        </Box>
        {badge && (
          <Box
            sx={{
              px: 0.75,
              py: 0.125,
              borderRadius: "4px",
              bgcolor: colors.primaryLight,
              border: `1px solid ${colors.primary}`,
              fontSize: "0.625rem",
              fontWeight: 600,
              color: colors.primary,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {badge}
          </Box>
        )}
      </Box>
      <Box sx={{ p: noPadding ? 0 : 1.75 }}>{children}</Box>
    </Box>
  );
}
