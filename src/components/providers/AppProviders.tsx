"use client";

import AuthInitializer from "@/features/auth/AuthInitializer";
import UiInitializer from "@/features/ui/UiInitializer";
import AppThemeProvider from "@/components/providers/AppThemeProvider";
import AppSnackbar from "@/components/ui/AppSnackbar";
import StoreProvider from "@/store/StoreProvider";

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppThemeProvider>
      <StoreProvider>
        <AuthInitializer />
        <UiInitializer />
        <AppSnackbar />
        {children}
      </StoreProvider>
    </AppThemeProvider>
  );
}
