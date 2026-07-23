import type { ReactNode } from "react";
import type { SxProps, Theme } from "@mui/material";
import { Box } from "@mui/material";

import AppCard from "@/components/ui/AppCard";

type ChartCardProps = {
  /** Chart section title. */
  title: string;
  /** Optional description under the title. */
  subtitle?: string;
  /** Chart or visualization content. */
  children: ReactNode;
  /** Fixed chart area height in px — defaults to 260. */
  height?: number;
  /** Optional header action. */
  action?: ReactNode;
  sx?: SxProps<Theme>;
};

/** AppCard wrapper for analytics charts with consistent title + plot area. */
export default function ChartCard({
  title,
  subtitle,
  children,
  height = 260,
  action,
  sx,
}: ChartCardProps) {
  return (
    <AppCard title={title} subtitle={subtitle} action={action} padding="lg" sx={sx}>
      <Box sx={{ width: "100%", height }}>{children}</Box>
    </AppCard>
  );
}
