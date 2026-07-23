"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

import { colors, displayFont } from "@/lib/theme";
import { radiusTokens } from "@/lib/tokens";

type AppModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  maxWidth?: "xs" | "sm" | "md" | "lg";
  /** Tighter content padding for dense forms */
  dense?: boolean;
};

export default function AppModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "sm",
  dense = false,
}: AppModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: `${radiusTokens.xl}px`,
            border: `1px solid ${colors.border}`,
            boxShadow: "0 16px 48px rgb(15 23 42 / 0.12)",
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          fontFamily: displayFont,
          fontWeight: 600,
          fontSize: "1.125rem",
          letterSpacing: "-0.01em",
          pb: description ? 0.75 : 1.5,
          pt: 2.5,
          px: 3,
        }}
      >
        {title}
      </DialogTitle>
      {description ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ px: 3, pb: 0.5, lineHeight: 1.6, fontSize: "0.875rem" }}
        >
          {description}
        </Typography>
      ) : null}
      {children ? (
        <DialogContent sx={{ pt: description ? 1.5 : 1, px: dense ? 2.5 : 3, pb: 0 }}>
          {children}
        </DialogContent>
      ) : null}
      {footer ? (
        <DialogActions
          sx={{
            px: dense ? 2.5 : 3,
            pb: 2.5,
            pt: 2,
            gap: 1,
            borderTop: `1px solid ${colors.border}`,
            bgcolor: colors.background,
          }}
        >
          {footer}
        </DialogActions>
      ) : null}
    </Dialog>
  );
}
