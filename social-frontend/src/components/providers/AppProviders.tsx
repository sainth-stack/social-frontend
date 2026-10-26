"use client";

import AuthInitializer from "@/features/auth/AuthInitializer";
import UiInitializer from "@/features/ui/UiInitializer";
import AppThemeProvider from "@/components/providers/AppThemeProvider";
import AppSnackbar from "@/components/ui/AppSnackbar";
import { Toaster } from "@/components/ui/sonner";
import StoreProvider from "@/store/StoreProvider";
import MockUiNotice from "@/components/providers/MockUiNotice";

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
        <Toaster />
        <MockUiNotice />
        {children}
      </StoreProvider>
    </AppThemeProvider>
  );
}
