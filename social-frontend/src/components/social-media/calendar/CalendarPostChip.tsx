"use client";

import { Box, Typography } from "@mui/material";

import type { CalendarPost } from "@/types/social-media.types";
import { PLATFORM_COLORS } from "@/types/social-media.types";

type CalendarPostChipProps = {
  post: CalendarPost;
  onClick?: () => void;
};

export default function CalendarPostChip({ post, onClick }: CalendarPostChipProps) {
  const platform = post.platforms[0] ?? "facebook";
  const color = PLATFORM_COLORS[platform];
  const time = post.scheduledAt
    ? new Date(post.scheduledAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 0.75,
        py: 0.35,
        borderRadius: "6px",
        bgcolor: `${color}14`,
        borderLeft: `3px solid ${color}`,
        cursor: "pointer",
        minWidth: 0,
        "&:hover": { bgcolor: `${color}22` },
      }}
    >
      <Typography
        sx={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {time} {post.captionPreview.slice(0, 20)}
        {post.captionPreview.length > 20 ? "…" : ""}
      </Typography>
    </Box>
  );
}
