"use client";

import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { Box, Stack, Typography } from "@mui/material";

import AppButton from "@/components/ui/AppButton";
import { colors, surfaceSx } from "@/lib/theme";

type StudioWorkflowStatusProps = {
  hasTopic: boolean;
  hasMedia: boolean;
  hasCopy: boolean;
  mediaLabel?: string | null;
  onGoToText?: () => void;
  onGenerateCopy?: () => void;
  generatingCopy?: boolean;
  compact?: boolean;
};

export default function StudioWorkflowStatus({
  hasTopic,
  hasMedia,
  hasCopy,
  mediaLabel,
  onGoToText,
  onGenerateCopy,
  generatingCopy = false,
  compact = false,
}: StudioWorkflowStatusProps) {
  const steps = [
    { done: hasTopic, label: "Post brief" },
    { done: hasMedia, label: mediaLabel ? `Media: ${mediaLabel}` : "Media (optional)" },
    { done: hasCopy, label: "Platform copy" },
  ];

  return (
    <Box
      sx={{
        ...surfaceSx,
        p: compact ? 1.25 : 1.5,
        borderRadius: "10px",
        bgcolor: colors.background,
      }}
    >
      <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: colors.textMuted, mb: 1, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Post assembly
      </Typography>
      <Stack spacing={0.75}>
        {steps.map((step) => (
          <Box key={step.label} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            {step.done ? (
              <CheckCircleOutlinedIcon sx={{ fontSize: 16, color: colors.primary }} />
            ) : (
              <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: colors.textMuted }} />
            )}
            <Typography sx={{ fontSize: "0.75rem", fontWeight: step.done ? 600 : 400, color: step.done ? colors.textPrimary : colors.textSecondary }}>
              {step.label}
            </Typography>
          </Box>
        ))}
      </Stack>

      {hasMedia && !hasCopy && onGenerateCopy && (
        <Box sx={{ mt: 1.25 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
            Media is attached to your post preview. Generate platform copy to finish.
          </Typography>
          <AppButton
            variant="secondary"
            size="small"
            fullWidth
            loading={generatingCopy}
            onClick={onGenerateCopy}
          >
            Generate Copy
          </AppButton>
        </Box>
      )}

      {!hasTopic && onGoToText && (
        <Box sx={{ mt: 1.25 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
            Add a post topic on the Text tab before generating copy.
          </Typography>
          <AppButton variant="ghost" size="small" fullWidth onClick={onGoToText}>
            Go to Text tab
          </AppButton>
        </Box>
      )}
    </Box>
  );
}
