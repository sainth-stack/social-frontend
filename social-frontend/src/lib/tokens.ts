/**
 * Brand tokens aligned with opsbrain-landing `globals.css`.
 * Single source for hex values — consumed by theme.ts and feature code.
 */
export const brandTokens = {
  primary: "#c2410c",
  primaryHover: "#9a3412",
  primaryLight: "#fff0e3",
  accent: "#10b981",
  accentHover: "#059669",
  accentLight: "#ecfdf5",
  surfaceWhite: "#ffffff",
  surfaceMuted: "#fffaf5",
  surfaceTint: "#fff0e3",
  ink: "#18181b",
  inkSoft: "#3f3630",
  textPrimary: "#18181b",
  textSecondary: "#62554b",
  textMuted: "#78695d",
  borderDefault: "#e7dcd2",
  borderMuted: "#f5ece4",
  borderHover: "#cbb9aa",
  ring: "#c2410c",
} as const;

export const darkBrandTokens = {
  primary: "#fb923c",
  primaryHover: "#fdba74",
  primaryLight: "#3b2619",
  accent: "#4ade94",
  accentHover: "#86efac",
  accentLight: "#12392c",
  surfaceWhite: "#241e19",
  surfaceMuted: "#181411",
  surfaceTint: "#3b2619",
  ink: "#fff7ed",
  inkSoft: "#e8dace",
  textPrimary: "#fff7ed",
  textSecondary: "#c4b5a9",
  textMuted: "#b7a597",
  borderDefault: "#493b32",
  borderMuted: "#302720",
  borderHover: "#766151",
  ring: "#fb923c",
} as const;

export const radiusTokens = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
} as const;

export const fontTokens = {
  sans: "var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif",
  display: "var(--font-display), 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
} as const;
