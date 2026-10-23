"use client";

import { useState } from "react";
import type { SvgIconComponent } from "@mui/icons-material";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import BarChartOutlined from "@mui/icons-material/BarChartOutlined";
import CampaignOutlined from "@mui/icons-material/CampaignOutlined";
import CelebrationOutlined from "@mui/icons-material/CelebrationOutlined";
import CompareOutlined from "@mui/icons-material/CompareOutlined";
import EventOutlined from "@mui/icons-material/EventOutlined";
import FormatQuoteOutlined from "@mui/icons-material/FormatQuoteOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import LightbulbOutlined from "@mui/icons-material/LightbulbOutlined";
import MovieOutlined from "@mui/icons-material/MovieOutlined";
import RateReviewOutlined from "@mui/icons-material/RateReviewOutlined";
import SchoolOutlined from "@mui/icons-material/SchoolOutlined";
import SmartDisplayOutlined from "@mui/icons-material/SmartDisplayOutlined";
import StayCurrentPortraitOutlined from "@mui/icons-material/StayCurrentPortraitOutlined";
import VideocamOutlined from "@mui/icons-material/VideocamOutlined";
import ViewCarouselOutlined from "@mui/icons-material/ViewCarouselOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import { Box, Chip, Stack, Tab, Tabs, Tooltip, Typography } from "@mui/material";

import { colors } from "@/lib/theme";

const ICON_MAP: Record<string, SvgIconComponent> = {
  AutoAwesomeOutlined,
  BarChartOutlined,
  CampaignOutlined,
  CelebrationOutlined,
  CompareOutlined,
  EventOutlined,
  FormatQuoteOutlined,
  GroupsOutlined,
  Inventory2Outlined,
  LightbulbOutlined,
  MovieOutlined,
  RateReviewOutlined,
  SchoolOutlined,
  SmartDisplayOutlined,
  StayCurrentPortraitOutlined,
  VideocamOutlined,
  ViewCarouselOutlined,
};

export type TemplateGalleryItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  thumbnailGradient: [string, string];
  icon: string;
};

type TemplateGalleryProps<T extends TemplateGalleryItem> = {
  templates: T[];
  categories: readonly string[];
  selectedId: string | null;
  onSelect: (template: T) => void;
};

export default function TemplateGallery<T extends TemplateGalleryItem>({
  templates,
  categories,
  selectedId,
  onSelect,
}: TemplateGalleryProps<T>) {
  const [category, setCategory] = useState<string>(categories[0]);

  const filtered =
    category === "All"
      ? templates
      : templates.filter((t) => t.category === category);

  const showCategoryTabs = categories.length > 1;

  return (
    <Stack spacing={1.25}>
      {showCategoryTabs && (
        <Tabs
          value={category}
          onChange={(_, v: string) => setCategory(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 32,
            "& .MuiTab-root": { minHeight: 32, py: 0.25, fontSize: "0.6875rem", textTransform: "none" },
          }}
        >
          {categories.map((c) => (
            <Tab key={c} value={c} label={c} />
          ))}
        </Tabs>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 1,
          maxHeight: 220,
          overflowY: "auto",
          pr: 0.25,
        }}
      >
        {filtered.map((template) => {
          const Icon = ICON_MAP[template.icon] ?? AutoAwesomeOutlined;
          const selected = selectedId === template.id;
          return (
            <Tooltip key={template.id} title={template.description} arrow placement="top">
              <Box
                onClick={() => onSelect(template)}
                sx={{
                borderRadius: "8px",
                border: `2px solid ${selected ? colors.primary : colors.border}`,
                bgcolor: selected ? colors.primaryLight : colors.paper,
                cursor: "pointer",
                overflow: "hidden",
                transition: "border-color 0.12s, box-shadow 0.12s",
                position: "relative",
                "&:hover": {
                  borderColor: colors.primary,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                },
              }}
            >
              {selected && (
                <CheckCircleOutlinedIcon
                  sx={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    fontSize: 16,
                    color: colors.primary,
                    zIndex: 1,
                  }}
                />
              )}
              <Box
                sx={{
                  height: 52,
                  background: `linear-gradient(135deg, ${template.thumbnailGradient[0]}, ${template.thumbnailGradient[1]})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon sx={{ fontSize: 22, color: "rgba(255,255,255,0.9)" }} />
              </Box>
              <Box sx={{ p: 0.875 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, lineHeight: 1.2, mb: 0.25 }}>
                  {template.name}
                </Typography>
                <Chip
                  label={template.category}
                  size="small"
                  sx={{ height: 16, fontSize: "0.5625rem", "& .MuiChip-label": { px: 0.75 } }}
                />
              </Box>
            </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Stack>
  );
}
