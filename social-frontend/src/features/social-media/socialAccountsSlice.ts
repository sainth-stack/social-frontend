import { createSlice } from "@reduxjs/toolkit";

import {
  disconnectSocialAccount,
  fetchSocialAccounts,
  getSocialOAuthUrl,
  reconnectSocialAccount,
  syncSocialAccount,
  updateSocialAccount,
} from "@/features/social-media/socialAccountsThunks";
import type { SocialAccount } from "@/types/social-media.types";

export type SocialAccountsState = {
  accounts: SocialAccount[];
  loading: boolean;
  error: string | null;
  oauthUrl: string | null;
};

const initialState: SocialAccountsState = {
  accounts: [],
  loading: false,
  error: null,
  oauthUrl: null,
};

function upsertAccount(accounts: SocialAccount[], account: SocialAccount): SocialAccount[] {
  const idx = accounts.findIndex((a) => a.id === account.id);
  if (idx === -1) return [...accounts, account];
  const next = [...accounts];
  next[idx] = account;
  return next;
}

const socialAccountsSlice = createSlice({
  name: "socialAccounts",
  initialState,
  reducers: {
    clearSocialOAuthUrl(state) {
      state.oauthUrl = null;
    },
    clearSocialAccountsError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSocialAccounts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSocialAccounts.fulfilled, (state, action) => {
        state.loading = false;
        state.accounts = action.payload;
      })
      .addCase(fetchSocialAccounts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to load accounts";
      })
      .addCase(updateSocialAccount.fulfilled, (state, action) => {
        state.accounts = upsertAccount(state.accounts, action.payload);
      })
      .addCase(updateSocialAccount.rejected, (state, action) => {
        state.error = action.payload ?? "Failed to update account";
      })
      .addCase(disconnectSocialAccount.fulfilled, (state, action) => {
        state.accounts = state.accounts.map((a) =>
          a.id === action.payload
            ? { ...a, isActive: false, tokenStatus: "disconnected" as const, isDefault: false }
            : a,
        );
      })
      .addCase(disconnectSocialAccount.rejected, (state, action) => {
        state.error = action.payload ?? "Failed to disconnect account";
      })
      .addCase(syncSocialAccount.fulfilled, (state, action) => {
        state.accounts = upsertAccount(state.accounts, action.payload);
      })
      .addCase(syncSocialAccount.rejected, (state, action) => {
        state.error = action.payload ?? "Failed to sync account";
      })
      .addCase(getSocialOAuthUrl.fulfilled, (state, action) => {
        state.oauthUrl = action.payload;
        state.error = null;
      })
      .addCase(getSocialOAuthUrl.rejected, (state, action) => {
        state.error = action.payload ?? "Failed to start OAuth";
      })
      .addCase(reconnectSocialAccount.fulfilled, (state, action) => {
        state.oauthUrl = action.payload;
        state.error = null;
      })
      .addCase(reconnectSocialAccount.rejected, (state, action) => {
        state.error = action.payload ?? "Failed to reconnect account";
      });
  },
});

export const { clearSocialOAuthUrl, clearSocialAccountsError } = socialAccountsSlice.actions;
export default socialAccountsSlice.reducer;
