"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { CssBaseline, ThemeProvider } from "@mui/material";

import { theme } from "@/lib/theme";

type AppThemeProviderProps = {
  children: React.ReactNode;
};

export default function AppThemeProvider({ children }: AppThemeProviderProps) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
