import type { ElementType } from "react";
import { Box, Paper, Typography } from "@mui/material";

import { colors, displayFont, surfaceSx } from "@/lib/theme";

export type StatTrend = "up" | "down" | "neutral";

type StatCardChange = {
  value: string;
  direction: StatTrend;
};

type StatCardProps = {
  title: string;
  value: string | number;
  change?: string | StatCardChange;
  helperText?: string;
  icon?: ElementType<{ sx?: object }>;
  trend?: StatTrend;
  showIcon?: boolean;
};

function trendPrefix(direction: StatTrend): string {
  if (direction === "up") return "↑ ";
  if (direction === "down") return "↓ ";
  return "";
}

export default function StatCard({
  title,
  value,
  change,
  helperText,
  icon: Icon,
  trend,
  showIcon = false,
}: StatCardProps) {
  const changeText = typeof change === "string" ? change : change?.value;
  const trendDirection =
    trend ?? (typeof change === "object" ? change.direction : "neutral");

  const trendColor =
    trendDirection === "up"
      ? colors.accent
      : trendDirection === "down"
        ? colors.error
        : colors.textSecondary;

  const secondaryLine = changeText ?? helperText;
  const showTrendPrefix = Boolean(changeText && typeof change === "object");

  return (
    <Paper
      variant="outlined"
      sx={{
        ...surfaceSx,
        p: 2.5,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
        transition: "box-shadow 0.15s ease, border-color 0.15s ease",
        "&:hover": {
          boxShadow: "0 4px 12px rgb(79 70 229 / 0.06)",
          borderColor: `${colors.primary}30`,
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontWeight: 500, fontSize: "0.8125rem", lineHeight: 1.4 }}
        >
          {title}
        </Typography>
        {showIcon && Icon ? (
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              bgcolor: colors.primaryLight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: colors.primary,
              flexShrink: 0,
            }}
          >
            <Icon sx={{ fontSize: 18 }} />
          </Box>
        ) : null}
      </Box>

      <Typography
        component="p"
        sx={{
          fontFamily: displayFont,
          fontWeight: 700,
          fontSize: "2rem",
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          color: "text.primary",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </Typography>

      {secondaryLine ? (
        <Typography
          variant="caption"
          sx={{
            color: changeText ? trendColor : "text.secondary",
            fontWeight: changeText ? 500 : 400,
            fontSize: "0.75rem",
            lineHeight: 1.4,
          }}
        >
          {showTrendPrefix ? `${trendPrefix(trendDirection)}${secondaryLine}` : secondaryLine}
        </Typography>
      ) : null}
    </Paper>
  );
}
