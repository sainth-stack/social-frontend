import type { ReactNode } from "react";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import { Box, Typography } from "@mui/material";

import { colors, displayFont } from "@/lib/theme";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

export default function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <Box sx={{ py: 6, px: 3, textAlign: "center" }}>
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: "12px",
          mx: "auto",
          mb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: colors.primaryLight,
          color: colors.primary,
        }}
      >
        {icon ?? <InboxOutlinedIcon sx={{ fontSize: 24 }} />}
      </Box>
      <Typography
        sx={{
          fontFamily: displayFont,
          fontWeight: 600,
          fontSize: "1rem",
          mb: 0.5,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mx: "auto", lineHeight: 1.6 }}>
          {description}
        </Typography>
      ) : null}
      {action ? <Box sx={{ mt: 2.5 }}>{action}</Box> : null}
    </Box>
  );
}
