"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { CssBaseline, ThemeProvider } from "@mui/material";

import { appThemes } from "@/lib/theme";
import { initializeTheme, THEME_MEDIA_QUERY, THEME_STORAGE_KEY, type ThemeMode, type ThemePreference } from "@/lib/theme-preference";

type AppThemeState = {
  mode: ThemeMode;
  preference: ThemePreference;
  setTheme: (preference: ThemePreference) => void;
  themeError: string | null;
};

const AppThemeContext = createContext<AppThemeState | null>(null);

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) throw new Error("useAppTheme requires AppThemeProvider");
  return context;
}

type AppThemeProviderProps = {
  children: React.ReactNode;
};

export default function AppThemeProvider({ children }: AppThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [preference, setPreference] = useState<ThemePreference>("light");
  const [themeError, setThemeError] = useState<string | null>(null);
  const preferenceRef = useRef<ThemePreference>("light");
  const mediaRef = useRef<MediaQueryList | null>(null);

  const apply = useCallback((next: ThemePreference, systemDark = mediaRef.current?.matches ?? false) => {
    const resolved = next === "system" ? (systemDark ? "dark" : "light") : next;
    preferenceRef.current = next;
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
    setPreference(next);
    setMode(resolved);
  }, []);

  useLayoutEffect(() => {
    const initial = initializeTheme();
    try { mediaRef.current = window.matchMedia(THEME_MEDIA_QUERY); } catch {}
    apply(initial.preference, initial.mode === "dark");
    const media = mediaRef.current;
    const onSystemChange = (event: MediaQueryListEvent) => {
      if (preferenceRef.current === "system") apply("system", event.matches);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== window.localStorage) return;
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      apply(event.newValue === "light" || event.newValue === "dark" || event.newValue === "system" ? event.newValue : "light");
      setThemeError(null);
    };
    media?.addEventListener?.("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media?.removeEventListener?.("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
      mediaRef.current = null;
    };
  }, [apply]);

  const setTheme = useCallback((next: ThemePreference) => {
    apply(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      setThemeError(null);
    } catch {
      setThemeError("Theme applied for this visit. Your browser could not remember it on this device.");
    }
  }, [apply]);

  return (
    <AppRouterCacheProvider>
      <AppThemeContext.Provider value={{ mode, preference, setTheme, themeError }}>
        <ThemeProvider theme={appThemes[mode]}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </AppThemeContext.Provider>
    </AppRouterCacheProvider>
  );
}
