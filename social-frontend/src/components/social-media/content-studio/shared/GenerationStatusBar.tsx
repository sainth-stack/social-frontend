"use client";

import type { ReactNode } from "react";
import { Alert, Box, LinearProgress, Stack, Typography } from "@mui/material";

type GenerationStatusBarProps = {
  loading?: boolean;
  loadingLabel?: string;
  loadingHint?: string;
  error?: string | null;
  onDismissError?: () => void;
  info?: ReactNode;
};

export default function GenerationStatusBar({
  loading = false,
  loadingLabel = "Generating...",
  loadingHint,
  error,
  onDismissError,
  info,
}: GenerationStatusBarProps) {
  return (
    <Stack spacing={1}>
      {info}
      {loading && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            {loadingLabel}
            {loadingHint ? ` — ${loadingHint}` : ""}
          </Typography>
          <LinearProgress />
        </Box>
      )}
      {error && (
        <Alert severity="error" onClose={onDismissError} sx={{ fontSize: "0.8125rem" }}>
          {error}
        </Alert>
      )}
    </Stack>
  );
}
