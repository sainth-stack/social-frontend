import type { Metadata } from "next";
import { Suspense } from "react";
import { CircularProgress, Box } from "@mui/material";

import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in · OpsBrain AI",
  description: "Sign in to your OpsBrain AI Social Media Manager workspace",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "background.paper",
          }}
        >
          <CircularProgress size={28} />
        </Box>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
