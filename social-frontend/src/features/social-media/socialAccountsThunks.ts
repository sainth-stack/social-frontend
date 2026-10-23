import { createAsyncThunk } from "@reduxjs/toolkit";

import socialMediaApi from "@/api/endpoints/social-media.api";
import { toApiError } from "@/api/errors";
import type {
  SocialAccount,
  SocialPlatform,
  UpdateSocialAccountPayload,
} from "@/types/social-media.types";

export const fetchSocialAccounts = createAsyncThunk<
  SocialAccount[],
  { orgId: string; platform?: SocialPlatform },
  { rejectValue: string }
>("socialAccounts/fetch", async ({ orgId, platform }, { rejectWithValue }) => {
  try {
    return await socialMediaApi.listAccounts(orgId, platform);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const updateSocialAccount = createAsyncThunk<
  SocialAccount,
  { orgId: string; accountId: string; payload: UpdateSocialAccountPayload },
  { rejectValue: string }
>("socialAccounts/update", async ({ orgId, accountId, payload }, { rejectWithValue }) => {
  try {
    return await socialMediaApi.updateAccount(orgId, accountId, payload);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const disconnectSocialAccount = createAsyncThunk<
  string,
  { orgId: string; accountId: string },
  { rejectValue: string }
>("socialAccounts/disconnect", async ({ orgId, accountId }, { rejectWithValue }) => {
  try {
    await socialMediaApi.deleteAccount(orgId, accountId);
    return accountId;
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const syncSocialAccount = createAsyncThunk<
  SocialAccount,
  { orgId: string; accountId: string },
  { rejectValue: string }
>("socialAccounts/sync", async ({ orgId, accountId }, { rejectWithValue }) => {
  try {
    return await socialMediaApi.syncAccount(orgId, accountId);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const getSocialOAuthUrl = createAsyncThunk<
  string,
  { orgId: string; platform: SocialPlatform },
  { rejectValue: string }
>("socialAccounts/oauthUrl", async ({ orgId, platform }, { rejectWithValue }) => {
  try {
    const { url } = await socialMediaApi.getOAuthUrl(orgId, platform);
    return url;
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const reconnectSocialAccount = createAsyncThunk<
  string,
  { orgId: string; accountId: string },
  { rejectValue: string }
>("socialAccounts/reconnect", async ({ orgId, accountId }, { rejectWithValue }) => {
  try {
    const { url } = await socialMediaApi.reconnectAccount(orgId, accountId);
    return url;
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});
