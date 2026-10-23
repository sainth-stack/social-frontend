"use client";

import { Chip } from "@mui/material";

import type { SocialPostStatus } from "@/types/social-media.types";

const CONFIG: Record<
  SocialPostStatus,
  { label: string; color: "default" | "info" | "warning" | "success" | "error" }
> = {
  draft: { label: "Draft", color: "default" },
  pending_approval: { label: "Pending approval", color: "warning" },
  scheduled: { label: "Scheduled", color: "info" },
  publishing: { label: "Publishing", color: "warning" },
  published: { label: "Published", color: "success" },
  failed: { label: "Failed", color: "error" },
  archived: { label: "Archived", color: "default" },
};

export default function PostStatusChip({ status }: { status: SocialPostStatus }) {
  const cfg = CONFIG[status];
  return <Chip size="small" label={cfg.label} color={cfg.color} />;
}
