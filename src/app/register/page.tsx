import type { Metadata } from "next";
import { Suspense } from "react";
import { Box, CircularProgress } from "@mui/material";

import RegisterForm from "./RegisterForm";
import { authPageSx } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Create account · OpsBrain AI",
  description: "Create your OpsBrain AI Social Media Manager workspace",
};

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ ...authPageSx, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress size={28} />
        </Box>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
