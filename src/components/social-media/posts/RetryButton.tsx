"use client";

import Link from "next/link";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { Tooltip } from "@mui/material";

import AppButton from "@/components/ui/AppButton";
import type { SocialPost, SocialPostPlatform } from "@/types/social-media.types";

const NON_RETRYABLE = new Set([
  "TOKEN_EXPIRED",
  "INVALID_IMAGE",
  "ACCOUNT_NOT_FOUND",
  "PERMISSION_DENIED",
  "UNSUPPORTED_PLATFORM",
  "INVALID_CONTENT",
]);

export function failedPlatforms(post: SocialPost): SocialPostPlatform[] {
  return post.platforms.filter((p) => p.status === "failed");
}

export function isRetryablePlatform(pp: SocialPostPlatform): boolean {
  if (!pp.errorCode) return true;
  return !NON_RETRYABLE.has(pp.errorCode);
}

export function hasRetryableFailure(post: SocialPost): boolean {
  return failedPlatforms(post).some(isRetryablePlatform);
}

export function hasTokenExpired(post: SocialPost): boolean {
  return failedPlatforms(post).some((p) => p.errorCode === "TOKEN_EXPIRED");
}

type RetryButtonProps = {
  post: SocialPost;
  loading?: boolean;
  onRetry: () => void;
  size?: "small" | "medium";
};

export default function RetryButton({
  post,
  loading,
  onRetry,
  size = "small",
}: RetryButtonProps) {
  const retryable = hasRetryableFailure(post);
  const tokenExpired = hasTokenExpired(post);

  if (tokenExpired && !retryable) {
    return (
      <AppButton
        size={size}
        variant="secondary"
        component={Link}
        href="/dashboard/accounts"
      >
        Reconnect account
      </AppButton>
    );
  }

  if (!retryable) {
    return (
      <Tooltip title="This error requires fixing content or reconnecting — retry is disabled">
        <span>
          <AppButton
            size={size}
            variant="secondary"
            disabled
            leftIcon={<RefreshOutlinedIcon fontSize="small" />}
          >
            Retry
          </AppButton>
        </span>
      </Tooltip>
    );
  }

  return (
    <AppButton
      size={size}
      variant="secondary"
      onClick={onRetry}
      loading={loading}
      leftIcon={loading ? undefined : <RefreshOutlinedIcon fontSize="small" />}
      sx={{ minWidth: 88 }}
    >
      Retry
    </AppButton>
  );
}
