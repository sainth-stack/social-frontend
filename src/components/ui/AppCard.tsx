import type { ReactNode } from "react";
import type { SxProps, Theme } from "@mui/material";
import { Box, Paper } from "@mui/material";

import SectionTitle from "@/components/ui/SectionTitle";
import { surfaceSx } from "@/lib/theme";

type AppCardPadding = "none" | "sm" | "md" | "lg";

const paddingMap: Record<AppCardPadding, number> = {
  none: 0,
  sm: 1.5,
  md: 2,
  lg: 3,
};

type AppCardProps = {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  padding?: AppCardPadding;
  noBorder?: boolean;
  sx?: SxProps<Theme>;
};

export default function AppCard({
  title,
  subtitle,
  action,
  children,
  padding = "md",
  noBorder = false,
  sx,
}: AppCardProps) {
  const hasHeader = Boolean(title || subtitle || action);
  const pad = paddingMap[padding];

  return (
    <Paper
      variant="outlined"
      sx={{
        ...surfaceSx,
        ...(noBorder && { border: "none", boxShadow: "none" }),
        overflow: "hidden",
        ...sx,
      }}
    >
      {hasHeader ? (
        <Box
          sx={{
            px: pad || 2,
            pt: 1.5,
            pb: subtitle ? 1.5 : 1.25,
            borderBottom: `1px solid`,
            borderColor: "divider",
          }}
        >
          <SectionTitle title={title ?? ""} subtitle={subtitle} action={action} spacing="none" />
        </Box>
      ) : null}
      <Box sx={{ p: pad }}>{children}</Box>
    </Paper>
  );
}
