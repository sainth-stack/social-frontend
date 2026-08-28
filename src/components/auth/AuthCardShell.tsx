"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Box, Paper, Stack, Typography } from "@mui/material";

import AuthShowcasePanel from "@/components/auth/AuthShowcasePanel";
import { PlatformLogo } from "@/components/ui/Logo";
import { platformBrand } from "@/lib/brand";
import {
  authFooterTextSx,
  authLayout,
  authSubtitleSx,
  authTitleSx,
} from "@/lib/authStyles";
import { authPageSx, colors } from "@/lib/theme";

type AuthCardShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export default function AuthCardShell({ title, subtitle, children, footer }: AuthCardShellProps) {
  return (
    <Box
      sx={{
        ...authPageSx,
        px: { xs: 1.5, sm: 2 },
        py: { xs: 2, sm: 3 },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          width: "100%",
          maxWidth: authLayout.cardMaxWidth,
          minHeight: { md: 600 },
          borderRadius: authLayout.cardRadius,
          overflow: "hidden",
          border: `1px solid ${colors.border}`,
          boxShadow: "0 24px 64px rgb(15 23 42 / 0.08), 0 8px 24px rgb(15 23 42 / 0.04)",
        }}
      >
        <Stack
          sx={{
            ...authLayout.formColumn,
            px: authLayout.formPadding,
            py: authLayout.formPaddingY,
            justifyContent: "space-between",
            bgcolor: colors.paper,
          }}
        >
          <Stack sx={{ gap: authLayout.headerGap }}>
            <Link
              href={platformBrand.marketingUrl}
              style={{ textDecoration: "none", width: "fit-content" }}
            >
              <PlatformLogo size={32} priority />
            </Link>

            <Stack sx={{ gap: authLayout.titleGap }}>
              <Typography component="h1" sx={authTitleSx}>
                {title}
              </Typography>
              <Typography sx={authSubtitleSx}>{subtitle}</Typography>
            </Stack>

            {children}
          </Stack>

          <Box sx={{ pt: { xs: 3, md: 4 } }}>
            <Typography component="div" align="center" sx={authFooterTextSx}>
              {footer}
            </Typography>
          </Box>
        </Stack>

        <AuthShowcasePanel />
      </Paper>
    </Box>
  );
}
