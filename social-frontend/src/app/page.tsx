"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress } from "@mui/material";

import { selectIsAuthenticated, selectIsAuthHydrated, selectUser } from "@/features/auth/authSlice";
import { getHomeRoute } from "@/lib/auth/users";
import { useAppSelector } from "@/store/hooks";

export default function HomePage() {
  const router = useRouter();
  const isHydrated = useAppSelector(selectIsAuthHydrated);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectUser);

  useEffect(() => {
    if (!isHydrated) return;
    if (isAuthenticated && user) {
      router.replace(getHomeRoute(user));
    } else {
      router.replace("/login");
    }
  }, [isHydrated, isAuthenticated, user, router]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
      }}
    >
      <CircularProgress size={28} />
    </Box>
  );
}
