export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "system";

export const THEME_STORAGE_KEY = "opsbrain-theme";
export const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function initializeTheme() {
  let preference: "light" | "dark" | "system" = "light";
  try {
    const saved = window.localStorage.getItem("opsbrain-theme");
    if (saved === "light" || saved === "dark" || saved === "system") preference = saved;
  } catch {}
  let systemDark = false;
  try {
    systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {}
  const mode = preference === "system" ? (systemDark ? "dark" : "light") : preference;
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.style.colorScheme = mode;
  return { preference, mode };
}

export const themeInitializationScript = `(${initializeTheme.toString()})();`;