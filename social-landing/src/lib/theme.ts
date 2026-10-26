export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "opsbrain-theme";

export const themeInitializationScript = `(function(){var preference="light";try{var saved=localStorage.getItem("opsbrain-theme");if(saved==="light"||saved==="dark"||saved==="system")preference=saved;}catch{}var dark=preference==="dark"||(preference==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);document.documentElement.style.colorScheme=dark?"dark":"light";})();`;

export function readThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "light";
  } catch {
    return "light";
  }
}