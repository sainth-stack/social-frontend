"use client";

import { useCallback, useEffect } from "react";
import { Alert, Box, CircularProgress, Grid, Typography } from "@mui/material";

import AccountCard from "@/components/social-media/accounts/AccountCard";
import ConnectAccountCard from "@/components/social-media/accounts/ConnectAccountCard";
import PageHeader from "@/components/ui/PageHeader";
import { selectUser } from "@/features/auth/authSlice";
import {
  selectActiveSocialAccounts,
  selectSocialAccountsError,
  selectSocialAccountsLoading,
} from "@/features/social-media/socialAccountsSelectors";
import { fetchSocialAccounts } from "@/features/social-media/socialAccountsThunks";
import { colors } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { SocialPlatform } from "@/types/social-media.types";

const PLATFORMS: SocialPlatform[] = ["facebook", "instagram", "linkedin", "x"];

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X (Twitter)",
};

const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  facebook: "#1877F2",
  instagram: "#E4405F",
  linkedin: "#0A66C2",
  x: "#111111",
};

export default function AccountsList() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";
  const accounts = useAppSelector(selectActiveSocialAccounts);
  const loading = useAppSelector(selectSocialAccountsLoading);
  const error = useAppSelector(selectSocialAccountsError);

  const refresh = useCallback(() => {
    if (orgId) void dispatch(fetchSocialAccounts({ orgId }));
  }, [dispatch, orgId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const accountsFor = (platform: SocialPlatform) =>
    accounts.filter((a) => a.platform === platform);

  const showInitialLoader = loading && accounts.length === 0;

  return (
    <Box>
      <PageHeader
        title="Connected Accounts"
        subtitle="Connect and manage social accounts across platforms."
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {showInitialLoader ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {accounts.length === 0 && (
            <Box
              sx={{
                textAlign: "center",
                py: 4,
                px: 2,
                border: `1px dashed ${colors.border}`,
                borderRadius: "14px",
                bgcolor: colors.paper,
                mb: 3,
              }}
            >
              <Typography sx={{ fontWeight: 600, mb: 1 }}>Connect your first account</Typography>
              <Typography variant="body2" color="text.secondary">
                Link Facebook, Instagram, LinkedIn, or X to start creating and scheduling posts.
              </Typography>
            </Box>
          )}

          {PLATFORMS.map((platform) => {
            const platformAccounts = accountsFor(platform);
            const color = PLATFORM_COLORS[platform];

            return (
              <Box key={platform} sx={{ mb: 4 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2 }}>
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: "8px",
                      bgcolor: `${color}14`,
                      color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: "0.75rem",
                    }}
                  >
                    {PLATFORM_LABELS[platform].charAt(0)}
                  </Box>
                  <Typography sx={{ fontWeight: 600, fontSize: "1rem" }}>
                    {PLATFORM_LABELS[platform]}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {platformAccounts.length} connected
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  {platformAccounts.map((account) => (
                    <Grid key={account.id} size={{ xs: 12, md: 6, lg: 4 }}>
                      <AccountCard orgId={orgId} account={account} onChanged={refresh} />
                    </Grid>
                  ))}
                  {orgId && (
                    <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                      <ConnectAccountCard
                        orgId={orgId}
                        platform={platform}
                        onConnected={refresh}
                      />
                    </Grid>
                  )}
                </Grid>
              </Box>
            );
          })}
        </>
      )}
    </Box>
  );
}
