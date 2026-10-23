"use client";

import { Chip, Stack } from "@mui/material";

import type { SocialPlatform } from "@/types/social-media.types";
import { PLATFORM_COLORS, PLATFORM_LABELS } from "@/types/social-media.types";

export default function PlatformBadge({
  platforms,
}: {
  platforms: SocialPlatform[];
}) {
  return (
    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
      {platforms.map((platform) => (
        <Chip
          key={platform}
          size="small"
          label={PLATFORM_LABELS[platform]}
          sx={{
            bgcolor: `${PLATFORM_COLORS[platform]}14`,
            color: PLATFORM_COLORS[platform],
            fontWeight: 600,
          }}
        />
      ))}
    </Stack>
  );
}
