import type { SxProps, Theme } from "@mui/material";

import { colors, displayFont } from "@/lib/theme";

/** Auth page layout tokens — aligned with opsbrain-landing spacing rhythm. */
export const authLayout = {
  cardMaxWidth: 1024,
  cardRadius: "24px",
  formColumn: {
    flex: "1 1 50%",
    maxWidth: { md: "50%" },
    minWidth: 0,
  },
  showcaseColumn: {
    flex: "1 1 50%",
    maxWidth: { md: "50%" },
    minWidth: 0,
  },
  formPadding: { xs: 3, sm: 4, md: 5.5 },
  formPaddingY: { xs: 3.5, sm: 4.5, md: 5 },
  sectionGap: 2.5,
  fieldGap: 2,
  headerGap: 3,
  titleGap: 1,
} as const;

/** Taller auth inputs with 10px radius — matches SaaS login mockups. */
export const authInputSx: SxProps<Theme> = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "10px",
    height: 44,
    fontSize: "0.9375rem",
    "& .MuiOutlinedInput-input": {
      py: "10px",
      px: "12px",
      height: "auto",
    },
    "& .MuiInputAdornment-positionStart": {
      ml: 0.75,
      mr: 0.25,
    },
    "& .MuiInputAdornment-positionEnd .MuiIconButton-root": {
      mr: 0.25,
    },
  },
};

export const authPrimaryButtonSx: SxProps<Theme> = {
  py: 1.4,
  minHeight: 44,
  borderRadius: "10px",
  fontSize: "0.9375rem",
  fontWeight: 600,
  textTransform: "none",
  boxShadow: "0 1px 2px rgb(79 70 229 / 0.2)",
  "&:hover": {
    boxShadow: "0 4px 12px rgb(79 70 229 / 0.28)",
  },
};

export const authTitleSx: SxProps<Theme> = {
  fontFamily: displayFont,
  fontWeight: 700,
  fontSize: { xs: "1.5rem", sm: "1.75rem" },
  letterSpacing: "-0.03em",
  lineHeight: 1.2,
  color: colors.textPrimary,
};

export const authSubtitleSx: SxProps<Theme> = {
  fontSize: "0.9375rem",
  lineHeight: 1.55,
  color: colors.textSecondary,
};

export const authFooterTextSx: SxProps<Theme> = {
  fontSize: "0.875rem",
  lineHeight: 1.5,
  color: colors.textSecondary,
};

export const authFooterLinkSx: SxProps<Theme> = {
  color: colors.primary,
  fontWeight: 600,
  textDecoration: "none",
  "&:hover": { textDecoration: "underline" },
};

export const authInlineLinkSx: SxProps<Theme> = {
  color: colors.primary,
  fontWeight: 600,
  textDecoration: "none",
  "&:hover": { textDecoration: "underline" },
};
