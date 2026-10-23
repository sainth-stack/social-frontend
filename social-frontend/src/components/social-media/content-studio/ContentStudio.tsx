"use client";

import { useEffect } from "react";
import Link from "next/link";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import DraftsOutlinedIcon from "@mui/icons-material/DraftsOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import PermMediaOutlinedIcon from "@mui/icons-material/PermMediaOutlined";
import RecordVoiceOverOutlinedIcon from "@mui/icons-material/RecordVoiceOverOutlined";
import { Box, Chip, Grid, Stack, Typography } from "@mui/material";

import PageHeader from "@/components/ui/PageHeader";
import AppButton from "@/components/ui/AppButton";
import { selectUser } from "@/features/auth/authSlice";
import { selectSocialPostsByStatus } from "@/features/social-media/socialPostsSelectors";
import { fetchSocialPosts } from "@/features/social-media/socialPostsThunks";
import { colors, surfaceSx } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { PLATFORM_LABELS } from "@/types/social-media.types";

const ACTIONS = [
  {
    title: "AI Generate",
    description: "Create platform-native posts from a topic and your brand voice.",
    href: "/dashboard/content-studio/generate",
    icon: AutoAwesomeOutlinedIcon,
    primary: true,
  },
  {
    title: "Media Library",
    description: "Browse AI-generated and uploaded images and videos stored in Amazon S3.",
    href: "/dashboard/content-studio/media",
    icon: PermMediaOutlinedIcon,
  },
  {
    title: "Open Draft",
    description: "Resume editing saved drafts and continue where you left off.",
    href: "/dashboard/content-studio/drafts",
    icon: DraftsOutlinedIcon,
  },
  {
    title: "Use Template",
    description: "Start from 10 proven revenue templates with AI copy and images.",
    href: "/dashboard/content-studio/templates",
    icon: MenuBookOutlinedIcon,
  },
  {
    title: "Brand Voice",
    description: "Configure tone, language rules, and CTA preferences for AI.",
    href: "/dashboard/content-studio/brand-voice",
    icon: RecordVoiceOverOutlinedIcon,
  },
];

export default function ContentStudio() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";
  const drafts = useAppSelector(selectSocialPostsByStatus("draft"));

  useEffect(() => {
    if (orgId) void dispatch(fetchSocialPosts({ orgId, status: "draft", pageSize: 5 }));
  }, [dispatch, orgId]);

  const recent = drafts.slice(0, 5);

  return (
    <Box>
      <PageHeader
        title="Content Studio"
        subtitle="Create AI-powered posts for all your platforms"
        primaryAction={
          <AppButton
            variant="primary"
            component={Link}
            href="/dashboard/content-studio/generate"
          >
            New Post
          </AppButton>
        }
      />

      <Grid container spacing={2} sx={{ mb: 4 }}>
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Grid key={action.href} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Box
                component={Link}
                href={action.href}
                sx={{
                  ...surfaceSx,
                  p: 3,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                  textDecoration: "none",
                  color: "inherit",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  borderColor: action.primary ? colors.primary : colors.border,
                  "&:hover": {
                    borderColor: colors.primary,
                    boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
                  },
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "10px",
                    bgcolor: action.primary ? colors.primaryLight : colors.background,
                    color: action.primary ? colors.primary : colors.textSecondary,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon />
                </Box>
                <Typography sx={{ fontWeight: 600 }}>{action.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8125rem" }}>
                  {action.description}
                </Typography>
              </Box>
            </Grid>
          );
        })}
      </Grid>

      <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Recent drafts</Typography>
      {recent.length === 0 ? (
        <Box sx={{ ...surfaceSx, p: 3, textAlign: "center" }}>
          <Typography color="text.secondary" sx={{ mb: 1.5 }}>
            No drafts yet. Start creating content.
          </Typography>
          <AppButton
            variant="primary"
            component={Link}
            href="/dashboard/content-studio/generate"
          >
            AI Generate
          </AppButton>
        </Box>
      ) : (
        <Stack
          direction="row"
          spacing={2}
          sx={{ overflowX: "auto", pb: 1 }}
        >
          {recent.map((draft) => {
            const preview =
              draft.platforms[0]?.caption || draft.title || draft.aiPrompt || "Untitled draft";
            return (
              <Box
                key={draft.id}
                component={Link}
                href={`/dashboard/content-studio/generate?draftId=${draft.id}`}
                sx={{
                  ...surfaceSx,
                  p: 2,
                  minWidth: 240,
                  maxWidth: 280,
                  textDecoration: "none",
                  color: "inherit",
                  flexShrink: 0,
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    mb: 1,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {preview}
                </Typography>
                <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                  {draft.platforms.map((p) => (
                    <Chip key={p.id} size="small" label={PLATFORM_LABELS[p.platform]} />
                  ))}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
