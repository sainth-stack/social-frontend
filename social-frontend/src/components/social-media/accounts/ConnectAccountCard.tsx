"use client";

import { Box, Typography } from "@mui/material";

import OAuthConnectButton from "@/components/social-media/accounts/OAuthConnectButton";
import { surfaceSx } from "@/lib/theme";
import type { SocialPlatform } from "@/types/social-media.types";

const PLATFORM_META: Record<
  SocialPlatform,
  { title: string; description: string; color: string }
> = {
  facebook: {
    title: "Facebook",
    description: "Connect Facebook Pages to publish posts and track engagement.",
    color: "#1877F2",
  },
  instagram: {
    title: "Instagram",
    description: "Connect Instagram Business accounts linked to a Facebook Page.",
    color: "#E4405F",
  },
  linkedin: {
    title: "LinkedIn",
    description: "Connect your LinkedIn profile to publish professional posts.",
    color: "#0A66C2",
  },
  x: {
    title: "X (Twitter)",
    description: "Connect X to publish text posts (free tier is text-only).",
    color: "#111111",
  },
};

type ConnectAccountCardProps = {
  orgId: string;
  platform: SocialPlatform;
  onConnected?: () => void;
};

export default function ConnectAccountCard({
  orgId,
  platform,
  onConnected,
}: ConnectAccountCardProps) {
  const meta = PLATFORM_META[platform];

  return (
    <Box
      sx={{
        ...surfaceSx,
        p: 3,
        borderStyle: "dashed",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minHeight: 160,
        justifyContent: "space-between",
      }}
    >
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              bgcolor: `${meta.color}14`,
              color: meta.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "0.875rem",
            }}
          >
            {meta.title.charAt(0)}
          </Box>
          <Typography sx={{ fontWeight: 600, fontSize: "0.9375rem" }}>{meta.title}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8125rem" }}>
          {meta.description}
        </Typography>
      </Box>

      <OAuthConnectButton
        orgId={orgId}
        platform={platform}
        label={`Connect ${meta.title}`}
        onSuccess={onConnected}
      />
    </Box>
  );
}
