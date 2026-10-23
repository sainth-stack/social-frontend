"use client";

import { Box, Typography } from "@mui/material";

import { colors } from "@/lib/theme";

export type StudioGenerationMode = "create" | "refine";

type GenerationModeToggleProps = {
  mode: StudioGenerationMode;
  onChange: (mode: StudioGenerationMode) => void;
  canRefine: boolean;
  refineHint?: string;
  disabled?: boolean;
};

export default function GenerationModeToggle({
  mode,
  onChange,
  canRefine,
  refineHint,
  disabled = false,
}: GenerationModeToggleProps) {
  if (!canRefine) return null;

  return (
    <Box>
      <Typography variant="caption" sx={{ color: colors.textSecondary, display: "block", mb: 0.5, fontWeight: 600 }}>
        Generation mode
      </Typography>
      <Box sx={{ display: "flex", gap: 0.5 }}>
        {(
          [
            { value: "create" as const, label: "New" },
            { value: "refine" as const, label: "Refine" },
          ] as const
        ).map(({ value, label }) => (
          <Box
            key={value}
            onClick={() => !disabled && onChange(value)}
            sx={{
              flex: 1,
              textAlign: "center",
              py: 0.625,
              borderRadius: "6px",
              cursor: disabled ? "default" : "pointer",
              border: `1.5px solid ${mode === value ? colors.primary : colors.border}`,
              bgcolor: mode === value ? colors.primaryLight : "transparent",
              fontSize: "0.75rem",
              fontWeight: mode === value ? 600 : 400,
              color: mode === value ? colors.primary : colors.textSecondary,
              opacity: disabled ? 0.6 : 1,
              "&:hover": disabled ? undefined : { borderColor: colors.primary },
            }}
          >
            {label}
          </Box>
        ))}
      </Box>
      {mode === "refine" && refineHint && (
        <Typography variant="caption" sx={{ color: colors.textMuted, display: "block", mt: 0.75, lineHeight: 1.4 }}>
          {refineHint}
        </Typography>
      )}
    </Box>
  );
}
