import type { ReactNode } from "react";
import type { SxProps, Theme } from "@mui/material";
import { Box } from "@mui/material";

type MetricGridProps = {
  children: ReactNode;
  columns?: { xs?: number; sm?: number; md?: number; lg?: number };
  gap?: number;
  sx?: SxProps<Theme>;
};

export default function MetricGrid({
  children,
  columns = { xs: 1, sm: 2, lg: 4 },
  gap = 2,
  sx,
}: MetricGridProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: `repeat(${columns.xs ?? 1}, 1fr)`,
          sm: `repeat(${columns.sm ?? 2}, 1fr)`,
          md: columns.md ? `repeat(${columns.md}, 1fr)` : undefined,
          lg: `repeat(${columns.lg ?? 4}, 1fr)`,
        },
        gap,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
