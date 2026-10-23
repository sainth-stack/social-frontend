"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Box, CircularProgress } from "@mui/material";

import { getHomeRoute } from "@/lib/auth/users";
import {
  selectIsAuthHydrated,
  selectIsAuthenticated,
  selectUser,
} from "@/features/auth/authSlice";
import { useAppSelector } from "@/store/hooks";

type AuthGuardProps = {
  children: React.ReactNode;
  /** When true, only platform admins may view this route. */
  requirePlatformAdmin?: boolean;
};

export default function AuthGuard({ children, requirePlatformAdmin = false }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isHydrated = useAppSelector(selectIsAuthHydrated);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectUser);

  const forbidden = Boolean(user) && requirePlatformAdmin && !user!.isPlatformAdmin;

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!isAuthenticated || !user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (requirePlatformAdmin && !user.isPlatformAdmin) {
      router.replace(getHomeRoute(user));
    }
  }, [isAuthenticated, isHydrated, pathname, requirePlatformAdmin, router, user]);

  if (!isHydrated) {
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

  if (!isAuthenticated || !user || forbidden) {
    return null;
  }

  return <>{children}</>;
}
