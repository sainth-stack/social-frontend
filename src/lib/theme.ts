"use client";

import { createTheme } from "@mui/material/styles";

import { brandTokens, fontTokens, radiusTokens } from "@/lib/tokens";

/** Card / surface corner radius */
export const RADIUS = radiusTokens.lg;

/** Table container corner radius */
export const TABLE_RADIUS = 10;

/** Input field corner radius */
export const INPUT_RADIUS = radiusTokens.md;

/** Display font for headings — matches landing Plus Jakarta Sans */
export const displayFont = fontTokens.display;

export const colors = {
  primary: brandTokens.primary,
  primaryLight: brandTokens.primaryLight,
  primaryDark: brandTokens.primaryHover,
  accent: brandTokens.accent,
  accentLight: brandTokens.accentLight,
  accentHover: brandTokens.accentHover,
  background: brandTokens.surfaceMuted,
  surfaceTint: brandTokens.surfaceTint,
  paper: brandTokens.surfaceWhite,
  border: brandTokens.borderDefault,
  borderHover: brandTokens.borderHover,
  textPrimary: brandTokens.textPrimary,
  textSecondary: brandTokens.textSecondary,
  textMuted: brandTokens.textMuted,
  ink: brandTokens.ink,
  success: brandTokens.accent,
  successLight: brandTokens.accentLight,
  warning: "#D97706",
  warningLight: "#FEF3C7",
  error: "#DC2626",
  errorLight: "#FEE2E2",
  muted: brandTokens.borderMuted,
  tableHeader: brandTokens.surfaceMuted,
  navActive: brandTokens.primaryLight,
  navHover: brandTokens.surfaceMuted,
  sectionLabel: brandTokens.textMuted,
  sidebar: brandTokens.surfaceWhite,
  chipDraftBg: "#F1F5F9",
  chipDraftText: brandTokens.textMuted,
  chipSuccessBg: brandTokens.accentLight,
  chipSuccessText: "#047857",
  chipWarningBg: "#FEF3C7",
  chipWarningText: "#B45309",
  chipInfoBg: brandTokens.primaryLight,
  chipInfoText: brandTokens.primaryHover,
  chipErrorBg: "#FEE2E2",
  chipErrorText: "#B91C1C",
  chipProspectBg: "#EDE9FE",
  chipProspectText: "#6D28D9",
  chipNegotiationBg: "#FEF9C3",
  chipNegotiationText: "#A16207",
  fieldLabel: brandTokens.textSecondary,
  ring: brandTokens.ring,
} as const;

/** Status chip palette — single source for StatusChip variants. */
export const statusChipColors = {
  draft: { bg: colors.chipDraftBg, color: colors.chipDraftText },
  running: { bg: colors.chipSuccessBg, color: colors.chipSuccessText, dot: colors.success },
  paused: { bg: colors.chipWarningBg, color: colors.chipWarningText, dot: colors.warning },
  completed: { bg: colors.chipSuccessBg, color: colors.chipSuccessText, dot: colors.success },
  active: { bg: colors.chipSuccessBg, color: colors.chipSuccessText, dot: colors.success },
  inactive: { bg: colors.chipDraftBg, color: colors.chipDraftText },
  qualified: { bg: colors.chipInfoBg, color: colors.chipInfoText, dot: colors.primary },
  failed: { bg: colors.chipErrorBg, color: colors.chipErrorText, dot: colors.error },
  warning: { bg: colors.chipWarningBg, color: colors.chipWarningText, dot: colors.warning },
  success: { bg: colors.chipSuccessBg, color: colors.chipSuccessText, dot: colors.success },
  prospecting: { bg: colors.chipProspectBg, color: colors.chipProspectText, dot: "#7C3AED" },
  negotiation: { bg: colors.chipNegotiationBg, color: colors.chipNegotiationText, dot: "#CA8A04" },
} as const;

export type StatusChipColorKey = keyof typeof statusChipColors;

/** Chart palette — indigo primary + emerald accent */
export const chartColors = {
  primary: colors.primary,
  secondary: colors.accent,
  grid: colors.border,
} as const;

/** Shared Recharts axis tick style. */
export const chartAxisTick = {
  fontSize: 12,
  fill: colors.textSecondary,
} as const;

/** Shared Recharts tooltip container style. */
export const chartTooltipStyle = {
  borderRadius: radiusTokens.md,
  border: `1px solid ${colors.border}`,
  fontSize: 12,
  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.08)",
} as const;

/** Table cell padding aligned with MuiTableCell overrides. */
export const tableCellPadding = {
  head: { py: 1.5, px: 2 },
  body: { py: 1.75, px: 2 },
} as const;

export const shadows = {
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  md: "0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.06)",
} as const;

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: colors.primary,
      light: colors.primaryLight,
      dark: colors.primaryDark,
      contrastText: "#FFFFFF",
    },
    success: {
      main: colors.success,
      light: colors.successLight,
      dark: colors.accentHover,
    },
    warning: {
      main: colors.warning,
      light: colors.warningLight,
    },
    error: {
      main: colors.error,
      light: colors.errorLight,
    },
    background: {
      default: colors.background,
      paper: colors.paper,
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
    },
    divider: colors.border,
  },
  typography: {
    fontFamily: fontTokens.sans,
    h4: {
      fontFamily: fontTokens.display,
      fontWeight: 600,
      fontSize: "1.5rem",
      lineHeight: 1.3,
      letterSpacing: "-0.015em",
      color: colors.textPrimary,
    },
    h5: {
      fontFamily: fontTokens.display,
      fontWeight: 600,
      fontSize: "1.125rem",
      lineHeight: 1.4,
      letterSpacing: "-0.01em",
    },
    h6: {
      fontFamily: fontTokens.display,
      fontWeight: 600,
      fontSize: "0.9375rem",
      lineHeight: 1.4,
    },
    body1: {
      fontSize: "1rem",
      lineHeight: 1.6,
    },
    body2: {
      fontSize: "0.875rem",
      lineHeight: 1.5,
    },
    caption: {
      fontSize: "0.75rem",
      lineHeight: 1.4,
    },
  },
  shape: {
    borderRadius: RADIUS,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: colors.background,
          color: colors.textPrimary,
        },
        "::selection": {
          backgroundColor: colors.primary,
          color: "#fff",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 500,
          borderRadius: radiusTokens.md,
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
          "&:focus": {
            outline: "none",
          },
          "&:focus-visible": {
            outline: "none",
            boxShadow: `0 0 0 2px ${colors.paper}, 0 0 0 4px ${colors.primary}`,
          },
        },
        contained: {
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
            backgroundColor: colors.primaryDark,
          },
          "&:focus-visible": {
            boxShadow: `0 0 0 2px ${colors.paper}, 0 0 0 4px ${colors.primary}`,
          },
        },
        outlined: {
          "&:focus-visible": {
            boxShadow: `0 0 0 2px ${colors.paper}, 0 0 0 4px ${colors.primary}`,
          },
        },
        sizeSmall: {
          fontSize: "0.8125rem",
          padding: "6px 14px",
          minHeight: 36,
        },
        sizeMedium: {
          fontSize: "0.875rem",
          padding: "8px 16px",
          minHeight: 44,
        },
        sizeLarge: {
          fontSize: "0.9375rem",
          padding: "10px 22px",
          minHeight: 48,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: radiusTokens.md,
          "&:focus-visible": {
            outline: `2px solid ${colors.ring}`,
            outlineOffset: 2,
          },
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: colors.paper,
        },
        outlined: {
          borderColor: colors.border,
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: RADIUS,
          border: `1px solid ${colors.border}`,
          boxShadow: shadows.sm,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: INPUT_RADIUS,
          backgroundColor: colors.paper,
          fontSize: "0.875rem",
          boxShadow: "none",
          "& fieldset": {
            borderColor: colors.border,
          },
          "&:hover fieldset": {
            borderColor: colors.borderHover,
          },
          "&.Mui-focused fieldset": {
            borderColor: colors.primary,
            borderWidth: 1,
            boxShadow: `0 0 0 2px rgb(79 70 229 / 0.15)`,
          },
          "&.MuiInputBase-multiline": {
            height: "auto",
            alignItems: "flex-start",
            py: 0,
          },
          "&.MuiInputBase-multiline textarea": {
            padding: "8px 12px",
            lineHeight: 1.5,
          },
        },
        input: {
          padding: "9px 12px",
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: "0.875rem",
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: INPUT_RADIUS,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          border: `1px solid ${colors.border}`,
          borderRadius: RADIUS,
          boxShadow: shadows.md,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: radiusTokens.xl,
          border: `1px solid ${colors.border}`,
          boxShadow: shadows.md,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 500,
          fontSize: "0.8125rem",
          color: colors.textSecondary,
          backgroundColor: colors.tableHeader,
          borderBottom: `1px solid ${colors.border}`,
          py: 1.5,
          px: 2,
        },
        body: {
          fontSize: "0.875rem",
          color: colors.textPrimary,
          borderBottom: `1px solid ${colors.border}`,
          py: 1.75,
          px: 2,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-child td": {
            borderBottom: 0,
          },
          "&:hover": {
            backgroundColor: colors.background,
          },
        },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        root: {
          borderTop: `1px solid ${colors.border}`,
          fontSize: "0.8125rem",
          color: colors.textSecondary,
        },
        toolbar: {
          minHeight: 52,
          px: 2,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          borderRadius: 999,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 48,
        },
        indicator: {
          height: 2,
          backgroundColor: colors.primary,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 500,
          fontSize: "0.875rem",
          minHeight: 48,
          color: colors.textSecondary,
          "&.Mui-selected": {
            color: colors.primary,
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: colors.border,
          "&.Mui-checked": {
            color: colors.primary,
          },
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: {
          color: colors.border,
          "&.Mui-checked": {
            color: colors.primary,
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: radiusTokens.md,
          bgcolor: colors.muted,
        },
        bar: {
          borderRadius: radiusTokens.md,
          bgcolor: colors.primary,
        },
      },
    },
  },
});

theme.shadows[1] = shadows.sm;
theme.shadows[2] = shadows.md;

export const layoutTokens = {
  sidebarWidth: 260,
  sidebarCollapsedWidth: 64,
  topbarHeight: 64,
  sidebarBrandHeight: 64,
  navItemHeight: 36,
  navRadius: radiusTokens.md,
  contentPadding: { xs: 2, md: 3 },
  contentMaxWidth: 1280,
  radius: RADIUS,
  tableRadius: TABLE_RADIUS,
  inputRadius: INPUT_RADIUS,
  activeNavBg: colors.navActive,
  navActiveBg: colors.navActive,
  navHoverBg: colors.navHover,
  sectionLabelColor: colors.sectionLabel,
  sidebarBg: colors.sidebar,
  tableHeaderBg: colors.tableHeader,
  borderColor: colors.border,
  mutedSurface: colors.background,
  surfaceTint: colors.surfaceTint,
  navIconColor: colors.textSecondary,
  navIconActiveColor: colors.primary,
  cardShadow: shadows.sm,
} as const;

export const surfaceSx = {
  borderRadius: `${RADIUS}px`,
  border: `1px solid ${colors.border}`,
  boxShadow: shadows.sm,
  bgcolor: colors.paper,
} as const;

export const tableSurfaceSx = {
  borderRadius: `${TABLE_RADIUS}px`,
  border: `1px solid ${colors.border}`,
  boxShadow: "none",
  bgcolor: colors.paper,
} as const;

export const cardSx = surfaceSx;

/** Centered form column — SaaS create/edit pages */
export const formContainerSx = {
  maxWidth: 560,
  mx: "auto",
  width: "100%",
} as const;

/** Wider centered form (import, multi-section) */
export const formContainerWideSx = {
  maxWidth: 720,
  mx: "auto",
  width: "100%",
} as const;

/** Landing-style hero gradient for auth pages */
export const authPageSx = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  px: 2,
  background: `linear-gradient(180deg, ${colors.surfaceTint} 0%, ${colors.background} 45%, ${colors.paper} 100%)`,
  position: "relative" as const,
  overflow: "hidden",
  "&::before": {
    content: '""',
    position: "absolute",
    top: "-20%",
    right: "-10%",
    width: "50%",
    height: "50%",
    borderRadius: "50%",
    background: `radial-gradient(circle, rgb(79 70 229 / 0.08) 0%, transparent 70%)`,
    pointerEvents: "none",
  },
  "&::after": {
    content: '""',
    position: "absolute",
    bottom: "-15%",
    left: "-5%",
    width: "40%",
    height: "40%",
    borderRadius: "50%",
    background: `radial-gradient(circle, rgb(16 185 129 / 0.06) 0%, transparent 70%)`,
    pointerEvents: "none",
  },
} as const;
