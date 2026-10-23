import type { ReactNode } from "react";
import type { SxProps, Theme } from "@mui/material";
import { Box, FormHelperText, Typography } from "@mui/material";

import { colors, INPUT_RADIUS } from "@/lib/theme";

export const fieldLabelSx = {
  display: "block",
  mb: 0.75,
  fontSize: "0.875rem",
  fontWeight: 500,
  color: colors.fieldLabel,
  lineHeight: 1.4,
} as const;

export const outlinedInputSx = (compact = false, multiline = false) => ({
  borderRadius: `${INPUT_RADIUS}px`,
  bgcolor: colors.paper,
  boxShadow: "none",
  fontSize: "0.875rem",
  transition: "border-color 0.15s ease",
  ...(multiline
    ? {
        height: "auto",
        alignItems: "flex-start",
        py: 0,
        "& .MuiOutlinedInput-input": {
          py: "8px",
          px: "12px",
          lineHeight: 1.5,
          resize: "vertical",
        },
      }
    : {
        height: compact ? 36 : 40,
        "& .MuiOutlinedInput-input": {
          py: compact ? "7px" : "9px",
          px: "12px",
          height: "auto",
        },
      }),
  "& fieldset": {
    borderColor: colors.border,
  },
  "&:hover fieldset": {
    borderColor: colors.borderHover,
  },
  "&.Mui-focused fieldset": {
    borderColor: colors.primary,
    borderWidth: 1,
    boxShadow: "0 0 0 2px rgb(79 70 229 / 0.15)",
  },
  "&.Mui-error fieldset": {
    borderColor: colors.error,
  },
  "& .MuiInputAdornment-root": {
    color: colors.textSecondary,
    "& .MuiSvgIcon-root": {
      fontSize: 18,
    },
  },
  "& .MuiInputAdornment-positionStart": {
    ml: 0.5,
    mr: 0,
  },
});

type AppFieldWrapperProps = {
  label?: ReactNode;
  helperText?: ReactNode;
  error?: boolean;
  required?: boolean;
  htmlFor?: string;
  fullWidth?: boolean;
  hideLabel?: boolean;
  sx?: SxProps<Theme>;
  children: ReactNode;
};

export function AppFieldWrapper({
  label,
  helperText,
  error,
  required,
  htmlFor,
  fullWidth = true,
  hideLabel = false,
  sx,
  children,
}: AppFieldWrapperProps) {
  const showLabel = Boolean(label) && !hideLabel;

  return (
    <Box sx={{ width: fullWidth ? "100%" : "auto", ...sx }}>
      {showLabel ? (
        <Typography component="label" htmlFor={htmlFor} sx={fieldLabelSx}>
          {label}
          {required ? (
            <Typography component="span" sx={{ color: "error.main", ml: 0.25 }}>
              *
            </Typography>
          ) : null}
        </Typography>
      ) : null}
      {children}
      {helperText ? (
        <FormHelperText error={error} sx={{ mx: 0, mt: 0.75, fontSize: "0.8125rem" }}>
          {helperText}
        </FormHelperText>
      ) : null}
    </Box>
  );
}
