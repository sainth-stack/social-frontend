import type { Metadata } from "next";
import { Suspense } from "react";
import { Box, CircularProgress } from "@mui/material";

import LoginForm from "./LoginForm";
import { authPageSx } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Sign in · OpsBrain AI",
  description: "Sign in to your OpsBrain AI Social Media Manager workspace",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ ...authPageSx, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress size={28} />
        </Box>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
