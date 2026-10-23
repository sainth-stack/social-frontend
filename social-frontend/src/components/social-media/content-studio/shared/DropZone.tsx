"use client";

import type { DragEvent, ReactNode } from "react";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import { Box, Typography } from "@mui/material";

import { colors, surfaceSx } from "@/lib/theme";

type DropZoneProps = {
  onFile: (file: File) => void;
  accept?: string;
  disabled?: boolean;
  label: string;
  hint?: string;
  children?: ReactNode;
  minHeight?: number;
};

export default function DropZone({
  onFile,
  accept,
  disabled = false,
  label,
  hint,
  children,
  minHeight = 72,
}: DropZoneProps) {
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <Box
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      sx={{
        ...surfaceSx,
        minHeight,
        borderStyle: "dashed",
        borderRadius: "10px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        px: 2,
        py: 1.5,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "default" : "pointer",
        transition: "border-color 0.12s, background-color 0.12s",
        "&:hover": disabled
          ? undefined
          : {
              borderColor: colors.primary,
              bgcolor: colors.primaryLight,
            },
      }}
    >
      {children ?? (
        <>
          <CloudUploadOutlinedIcon sx={{ fontSize: 20, color: colors.textMuted }} />
          <Box>
            <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>{label}</Typography>
            {hint && (
              <Typography variant="caption" color="text.secondary">
                {hint}
              </Typography>
            )}
            {accept && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {accept}
              </Typography>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
