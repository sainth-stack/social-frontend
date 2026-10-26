"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { readThemePreference, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

const ThemeContext = createContext<{ preference: ThemePreference; setPreference: (preference: ThemePreference) => void }>({ preference: "light", setPreference: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setTheme] = useState<ThemePreference>("light");
  const currentPreference = useRef<ThemePreference>("light");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (next: ThemePreference) => {
      currentPreference.current = next;
      const dark = next === "dark" || (next === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
      setTheme(next);
    };
    const sync = () => apply(readThemePreference());
    const onSystemChange = () => apply(currentPreference.current);
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) sync();
    };
    const onChange = (event: Event) => apply((event as CustomEvent<ThemePreference>).detail);
    sync();
    media.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    window.addEventListener("earnedvoice-theme-change", onChange);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("earnedvoice-theme-change", onChange);
    };
  }, []);

  const setPreference = (next: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
    window.dispatchEvent(new CustomEvent("earnedvoice-theme-change", { detail: next }));
  };

  return <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}