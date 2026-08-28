import { createSelector } from "@reduxjs/toolkit";

import type { RootState } from "@/store";
import type { SocialPlatform } from "@/types/social-media.types";

export const selectSocialAccountsState = (state: RootState) => state.socialAccounts;

export const selectSocialAccounts = (state: RootState) => state.socialAccounts.accounts;

export const selectSocialAccountsLoading = (state: RootState) => state.socialAccounts.loading;

export const selectSocialAccountsError = (state: RootState) => state.socialAccounts.error;

export const selectSocialOAuthUrl = (state: RootState) => state.socialAccounts.oauthUrl;

export const selectSocialAccountsByPlatform = (platform: SocialPlatform) =>
  createSelector(selectSocialAccounts, (accounts) =>
    accounts.filter((a) => a.platform === platform && a.isActive),
  );

export const selectActiveSocialAccounts = createSelector(selectSocialAccounts, (accounts) =>
  accounts.filter((a) => a.isActive),
);

export const selectExpiredSocialAccountsCount = createSelector(selectSocialAccounts, (accounts) =>
  accounts.filter((a) => a.isActive && a.tokenStatus === "expired").length,
);
