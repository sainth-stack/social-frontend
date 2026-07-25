"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  size?: "sm" | "default";
};

export default function RetryButton({
  post,
  loading,
  onRetry,
  size = "sm",
}: RetryButtonProps) {
  const retryable = hasRetryableFailure(post);
  const tokenExpired = hasTokenExpired(post);

  if (tokenExpired && !retryable) {
    return (
      <Button size={size} variant="outline" asChild>
        <Link href="/dashboard/accounts">Reconnect account</Link>
      </Button>
    );
  }

  if (!retryable) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size={size} variant="outline" disabled>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Retry
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            This error requires fixing content or reconnecting — retry is disabled
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button size={size} variant="outline" disabled={loading} onClick={onRetry}>
      <RefreshCw className="mr-2 h-3.5 w-3.5" />
      Retry
    </Button>
  );
}
