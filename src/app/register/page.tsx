import type { Metadata } from "next";
import { Suspense } from "react";
import { CircularProgress, Box } from "@mui/material";

import RegisterForm from "./RegisterForm";

export const metadata: Metadata = {
  title: "Create account · OpsBrain AI",
  description: "Create your OpsBrain AI Social Media Manager workspace",
};

export default function RegisterPage() {
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
      <RegisterForm />
    </Suspense>
  );
}
