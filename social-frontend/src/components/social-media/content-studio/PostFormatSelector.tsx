"use client";

import type { SvgIconComponent } from "@mui/icons-material";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import FormatListNumberedOutlinedIcon from "@mui/icons-material/FormatListNumberedOutlined";
import SmartDisplayOutlinedIcon from "@mui/icons-material/SmartDisplayOutlined";
import StayCurrentPortraitOutlinedIcon from "@mui/icons-material/StayCurrentPortraitOutlined";
import ViewCarouselOutlinedIcon from "@mui/icons-material/ViewCarouselOutlined";
import type { SxProps } from "@mui/material";
import { Box, Tooltip, Typography } from "@mui/material";

import { colors } from "@/lib/theme";
import type { PostFormat, SocialPlatform } from "@/types/social-media.types";

type FormatConfig = {
  label: string;
  Icon: SvgIconComponent;
  description: string;
  platforms: SocialPlatform[];
};

export const FORMAT_CONFIG: Record<PostFormat, FormatConfig> = {
  single: {
    label: "Single Post",
    Icon: ArticleOutlinedIcon,
    description: "Standard single post with optional image or video",
    platforms: ["linkedin", "facebook", "instagram", "x"],
  },
  carousel: {
    label: "Carousel",
    Icon: ViewCarouselOutlinedIcon,
    description: "2–10 swipeable slides",
    platforms: ["linkedin", "instagram"],
  },
  reel: {
    label: "Reel",
    Icon: SmartDisplayOutlinedIcon,
    description: "Short vertical video — Instagram Reel or TikTok-style",
    platforms: ["instagram", "facebook"],
  },
  thread: {
    label: "Thread",
    Icon: FormatListNumberedOutlinedIcon,
    description: "Connected tweet chain on X",
    platforms: ["x"],
  },
  story: {
    label: "Story",
    Icon: StayCurrentPortraitOutlinedIcon,
    description: "Vertical 9:16 ephemeral content",
    platforms: ["instagram", "facebook"],
  },
  poll: {
    label: "Poll",
    Icon: BarChartOutlinedIcon,
    description: "Question with 2–4 answer options",
    platforms: ["linkedin", "x", "facebook"],
  },
};

/** Returns the formats available for the given platform set (union). */
export function getAvailableFormats(selectedPlatforms: SocialPlatform[]): PostFormat[] {
  if (selectedPlatforms.length === 0) return Object.keys(FORMAT_CONFIG) as PostFormat[];
  const all = Object.entries(FORMAT_CONFIG) as [PostFormat, FormatConfig][];
  return all
    .filter(([, cfg]) => cfg.platforms.some((p) => selectedPlatforms.includes(p)))
    .map(([fmt]) => fmt);
}

type PostFormatSelectorProps = {
  value: PostFormat;
  onChange: (format: PostFormat) => void;
  activePlatforms?: SocialPlatform[];
  sx?: SxProps;
};

export default function PostFormatSelector({
  value,
  onChange,
  activePlatforms = [],
  sx,
}: PostFormatSelectorProps) {
  const available = getAvailableFormats(activePlatforms);

  // If current value is no longer available, auto-correct to "single"
  const safeValue = available.includes(value) ? value : "single";

  return (
    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", ...sx }}>
      {available.map((format) => {
        const cfg = FORMAT_CONFIG[format];
        const active = safeValue === format;
        return (
          <Tooltip key={format} title={cfg.description} placement="bottom" arrow>
            <Box
              onClick={() => onChange(format)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.625,
                px: 1.25,
                py: 0.625,
                borderRadius: "6px",
                border: `1.5px solid ${active ? colors.primary : colors.border}`,
                bgcolor: active ? colors.primaryLight : "transparent",
                cursor: "pointer",
                transition: "all 0.12s",
                userSelect: "none",
                "&:hover": {
                  borderColor: colors.primary,
                  bgcolor: colors.primaryLight,
                },
              }}
            >
              <cfg.Icon
                sx={{
                  fontSize: 15,
                  color: active ? colors.primary : colors.textSecondary,
                }}
              />
              <Typography
                sx={{
                  fontSize: "0.8125rem",
                  fontWeight: active ? 600 : 500,
                  color: active ? colors.primary : colors.textSecondary,
                  whiteSpace: "nowrap",
                }}
              >
                {cfg.label}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}
