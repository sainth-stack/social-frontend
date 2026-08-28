/**
 * Brand tokens aligned with opsbrain-landing `globals.css`.
 * Single source for hex values — consumed by theme.ts and feature code.
 */
export const brandTokens = {
  primary: "#4f46e5",
  primaryHover: "#4338ca",
  primaryLight: "#eef2ff",
  accent: "#10b981",
  accentHover: "#059669",
  accentLight: "#ecfdf5",
  surfaceWhite: "#ffffff",
  surfaceMuted: "#f8fafc",
  surfaceTint: "#f5f3ff",
  ink: "#0f172a",
  inkSoft: "#1e293b",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#64748b",
  borderDefault: "#e2e8f0",
  borderMuted: "#f1f5f9",
  borderHover: "#cbd5e1",
  ring: "#4f46e5",
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
