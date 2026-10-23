"use client";

import Link from "next/link";
import { Box, Typography } from "@mui/material";

import AppButton from "@/components/ui/AppButton";

export default function NotFound() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        px: 2,
      }}
    >
      <Box sx={{ textAlign: "center", maxWidth: 420 }}>
        <Typography sx={{ fontWeight: 600, fontSize: "1.25rem", mb: 1 }}>
          Page not found
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          The page you are looking for does not exist or may have been moved.
        </Typography>
        <Box sx={{ display: "flex", gap: 1, justifyContent: "center", flexWrap: "wrap" }}>
          <AppButton component={Link} href="/login">
            Go to login
          </AppButton>
          <AppButton component={Link} href="/dashboard" variant="secondary">
            Go to dashboard
          </AppButton>
        </Box>
      </Box>
    </Box>
  );
}
