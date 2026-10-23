import { Box, Typography } from "@mui/material";

import { colors } from "@/lib/theme";

type AuthEmailDividerProps = {
  label?: string;
};

export default function AuthEmailDivider({ label = "or continue with email" }: AuthEmailDividerProps) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.25 }}>
      <Box sx={{ flex: 1, height: "1px", bgcolor: colors.border }} />
      <Typography
        sx={{
          fontSize: "0.8125rem",
          fontWeight: 400,
          color: colors.textMuted,
          whiteSpace: "nowrap",
          px: 0.25,
        }}
      >
        {label}
      </Typography>
      <Box sx={{ flex: 1, height: "1px", bgcolor: colors.border }} />
    </Box>
  );
}
