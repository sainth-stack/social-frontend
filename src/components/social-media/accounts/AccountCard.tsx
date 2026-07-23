"use client";

import { useState } from "react";
import { Avatar, Box, Chip, Divider, Stack, Typography } from "@mui/material";

import AppButton from "@/components/ui/AppButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import OAuthConnectButton from "@/components/social-media/accounts/OAuthConnectButton";
import TokenStatusBadge from "@/components/social-media/accounts/TokenStatusBadge";
import {
  disconnectSocialAccount,
  syncSocialAccount,
  updateSocialAccount,
} from "@/features/social-media/socialAccountsThunks";
import { enqueueToast } from "@/features/ui/uiSlice";
import { colors, surfaceSx } from "@/lib/theme";
import { useAppDispatch } from "@/store/hooks";
import type { SocialAccount } from "@/types/social-media.types";

function formatFollowers(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type AccountCardProps = {
  orgId: string;
  account: SocialAccount;
  onChanged?: () => void;
};

export default function AccountCard({ orgId, account, onChanged }: AccountCardProps) {
  const dispatch = useAppDispatch();
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const needsReconnect =
    account.tokenStatus === "expired" || account.tokenStatus === "disconnected";

  const run = async (fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      dispatch(enqueueToast({ message: successMsg, severity: "success" }));
      onChanged?.();
    } catch (err) {
      const message = typeof err === "string" ? err : "Action failed";
      dispatch(enqueueToast({ message, severity: "error" }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Box
        sx={{
          ...surfaceSx,
          p: 3,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {needsReconnect && (
          <Box
            sx={{
              bgcolor: colors.errorLight,
              color: colors.error,
              borderRadius: "10px",
              px: 1.5,
              py: 1,
              fontSize: "0.8125rem",
              fontWeight: 500,
            }}
          >
            Token expired — reconnect to keep publishing.
          </Box>
        )}

        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
          <Avatar
            src={account.accountPictureUrl ?? undefined}
            alt={account.accountName}
            sx={{ width: 48, height: 48 }}
          >
            {account.accountName.charAt(0)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontWeight: 600, fontSize: "0.9375rem" }} noWrap>
                {account.accountName}
              </Typography>
              <TokenStatusBadge status={account.tokenStatus} />
              {account.isDefault && (
                <Chip label="Default" size="small" color="primary" variant="outlined" />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, fontSize: "0.8125rem" }}>
              {account.accountType.charAt(0).toUpperCase() + account.accountType.slice(1)}
              {" · "}
              {formatFollowers(account.followerCount)} followers
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.25, fontSize: "0.75rem", color: colors.textMuted }}>
              Last synced {formatRelative(account.lastSyncedAt)}
            </Typography>
          </Box>
        </Box>

        <Divider />

        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          {needsReconnect ? (
            <OAuthConnectButton
              orgId={orgId}
              platform={account.platform}
              accountId={account.id}
              label="Reconnect"
              variant="primary"
              onSuccess={onChanged}
            />
          ) : (
            <>
              {!account.isDefault && (
                <AppButton
                  size="small"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        dispatch(
                          updateSocialAccount({
                            orgId,
                            accountId: account.id,
                            payload: { isDefault: true },
                          }),
                        ).unwrap(),
                      "Default account updated",
                    )
                  }
                >
                  Set as default
                </AppButton>
              )}
              <AppButton
                size="small"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      dispatch(
                        syncSocialAccount({ orgId, accountId: account.id }),
                      ).unwrap(),
                    "Account stats synced",
                  )
                }
              >
                Sync stats
              </AppButton>
            </>
          )}
          <AppButton
            size="small"
            variant="danger"
            disabled={busy}
            onClick={() => setDisconnectOpen(true)}
          >
            Disconnect
          </AppButton>
        </Stack>
      </Box>

      <ConfirmDialog
        open={disconnectOpen}
        title="Disconnect account?"
        description="Scheduled posts for this account may fail until you reconnect. You can reconnect anytime."
        confirmLabel="Disconnect"
        danger
        loading={busy}
        onCancel={() => setDisconnectOpen(false)}
        onConfirm={() => {
          setDisconnectOpen(false);
          void run(
            () =>
              dispatch(
                disconnectSocialAccount({ orgId, accountId: account.id }),
              ).unwrap(),
            "Account disconnected",
          );
        }}
      />
    </>
  );
}
