"use client";

import { useState } from "react";

import AppButton from "@/components/ui/AppButton";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { enqueueToast } from "@/features/ui/uiSlice";
import { useAppDispatch } from "@/store/hooks";
import type { SocialPlatform } from "@/types/social-media.types";

type OAuthConnectButtonProps = {
  orgId: string;
  platform: SocialPlatform;
  label?: string;
  accountId?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "small" | "medium" | "large";
  onSuccess?: () => void;
  disabled?: boolean;
};

const OAUTH_MESSAGE_SOURCE = "opsbrain-social-oauth";

export function openSocialOAuthPopup(
  url: string,
  onResult: (success: boolean, message?: string, silent?: boolean) => void,
): void {
  const popup = window.open(url, "opsbrain-social-oauth", "width=600,height=700");
  if (!popup) {
    onResult(false, "Popup blocked — allow popups for this site and try again");
    return;
  }

  let settled = false;
  const settle = (success: boolean, message?: string, silent?: boolean) => {
    if (settled) return;
    settled = true;
    window.removeEventListener("message", handler);
    window.clearInterval(timer);
    onResult(success, message, silent);
  };

  const handler = (event: MessageEvent) => {
    const data = event.data;
    if (!data || data.source !== OAUTH_MESSAGE_SOURCE) return;
    settle(data.status === "success", data.message);
  };

  window.addEventListener("message", handler);

  const timer = window.setInterval(() => {
    if (popup.closed && !settled) {
      settle(false, "Authorization was cancelled");
    }
  }, 500);
}

export default function OAuthConnectButton({
  orgId,
  platform,
  label,
  accountId,
  variant = "primary",
  size = "small",
  onSuccess,
  disabled,
}: OAuthConnectButtonProps) {
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { url } = accountId
        ? await socialMediaApi.reconnectAccount(orgId, accountId)
        : await socialMediaApi.getOAuthUrl(orgId, platform);

      openSocialOAuthPopup(url, (success, message, silent) => {
        setLoading(false);
        if (success) {
          if (!silent) {
            dispatch(enqueueToast({ message: "Account connected", severity: "success" }));
          }
          onSuccess?.();
        } else {
          dispatch(
            enqueueToast({
              message: message || "Connection failed",
              severity: "error",
            }),
          );
        }
      });
    } catch {
      setLoading(false);
      dispatch(
        enqueueToast({
          message: `Failed to start ${platform} connection`,
          severity: "error",
        }),
      );
    }
  };

  return (
    <AppButton
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled || !orgId}
      loading={loading}
    >
      {label ?? `Connect ${platform.charAt(0).toUpperCase()}${platform.slice(1)}`}
    </AppButton>
  );
}
