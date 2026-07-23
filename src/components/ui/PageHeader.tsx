import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

import { colors, displayFont } from "@/lib/theme";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  /** @deprecated Use `primaryAction` */
  action?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  size?: "page" | "section";
};

export default function PageHeader({
  title,
  subtitle,
  eyebrow,
  action,
  primaryAction,
  secondaryAction,
  size = "page",
}: PageHeaderProps) {
  const isPage = size === "page";
  const mainAction = primaryAction ?? action;
  const actions =
    mainAction || secondaryAction ? (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
        {secondaryAction}
        {mainAction}
      </Box>
    ) : null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 2,
        mb: isPage ? 3 : 2,
        flexWrap: "wrap",
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow ? (
          <Typography
            sx={{
              mb: 0.75,
              fontSize: "0.75rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: colors.primary,
              lineHeight: 1.4,
            }}
          >
            {eyebrow}
          </Typography>
        ) : null}
        <Typography
          component="h1"
          sx={{
            fontFamily: displayFont,
            fontWeight: 600,
            fontSize: isPage ? "1.75rem" : "1.125rem",
            letterSpacing: "-0.015em",
            lineHeight: 1.25,
            color: "text.primary",
          }}
        >
          {title}
        </Typography>
        {subtitle ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.75, maxWidth: 560, fontSize: "0.9375rem", lineHeight: 1.6 }}
          >
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {actions}
    </Box>
  );
}
