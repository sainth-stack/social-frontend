"use client";

import { Chip } from "@mui/material";

import type { SocialTokenStatus } from "@/types/social-media.types";

const LABELS: Record<SocialTokenStatus, string> = {
  active: "Active",
  expires_soon: "Expires soon",
  expired: "Expired",
  disconnected: "Disconnected",
};

const COLORS: Record<SocialTokenStatus, "success" | "warning" | "error" | "default"> = {
  active: "success",
  expires_soon: "warning",
  expired: "error",
  disconnected: "default",
};

type TokenStatusBadgeProps = {
  status: SocialTokenStatus;
};

export default function TokenStatusBadge({ status }: TokenStatusBadgeProps) {
  return (
    <Chip
      label={LABELS[status]}
      size="small"
      color={COLORS[status]}
      variant={status === "disconnected" ? "outlined" : "filled"}
    />
  );
}
