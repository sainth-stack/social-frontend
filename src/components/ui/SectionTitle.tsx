import type { ReactNode } from "react";
import type { SxProps, Theme } from "@mui/material";
import { Box, Typography } from "@mui/material";

import { displayFont } from "@/lib/theme";

type SectionTitleProps = {
  /** Primary section heading (0.9375rem / semibold). */
  title: string;
  /** Optional supporting line below the title. */
  subtitle?: string;
  /** Optional trailing action (button, link). */
  action?: ReactNode;
  /** Bottom margin — defaults to 2 when subtitle present, else 0.25–2 via `spacing`. */
  spacing?: "none" | "sm" | "md";
  sx?: SxProps<Theme>;
};

const spacingMap = {
  none: 0,
  sm: 1,
  md: 2,
} as const;

/** Shared section heading used in cards, charts, and form sections. */
export default function SectionTitle({
  title,
  subtitle,
  action,
  spacing = subtitle ? "md" : "sm",
  sx,
}: SectionTitleProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 2,
        mb: spacingMap[spacing],
        ...sx,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="h2"
          sx={{
            fontFamily: displayFont,
            fontWeight: 600,
            fontSize: "0.9375rem",
            lineHeight: 1.4,
            color: "text.primary",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </Typography>
        {subtitle ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.25, fontSize: "0.8125rem", lineHeight: 1.5 }}
          >
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
    </Box>
  );
}
