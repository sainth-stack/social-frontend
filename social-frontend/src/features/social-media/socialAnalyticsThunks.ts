import { createAsyncThunk } from "@reduxjs/toolkit";

import socialMediaApi from "@/api/endpoints/social-media.api";
import { toApiError } from "@/api/errors";
import type {
  AnalyticsOverview,
  AudienceGrowth,
  PlatformAnalytics,
  PostPerformanceItem,
  SocialPlatform,
} from "@/types/social-media.types";

type RangeArg = { orgId: string; from: string; to: string };

export const fetchAnalyticsOverview = createAsyncThunk<
  AnalyticsOverview,
  RangeArg,
  { rejectValue: string }
>("socialAnalytics/overview", async ({ orgId, from, to }, { rejectWithValue }) => {
  try {
    return await socialMediaApi.getAnalyticsOverview(orgId, { from, to });
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const fetchPlatformAnalytics = createAsyncThunk<
  PlatformAnalytics,
  RangeArg & { platform: SocialPlatform },
  { rejectValue: string }
>("socialAnalytics/platform", async ({ orgId, platform, from, to }, { rejectWithValue }) => {
  try {
    return await socialMediaApi.getPlatformAnalytics(orgId, platform, { from, to });
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const fetchPostPerformance = createAsyncThunk<
  PostPerformanceItem[],
  RangeArg & { sort?: string; order?: string },
  { rejectValue: string }
>("socialAnalytics/posts", async ({ orgId, from, to, sort, order }, { rejectWithValue }) => {
  try {
    const data = await socialMediaApi.getPostPerformance(orgId, { from, to, sort, order });
    return data.items;
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const fetchAudienceGrowth = createAsyncThunk<
  AudienceGrowth,
  RangeArg,
  { rejectValue: string }
>("socialAnalytics/audience", async ({ orgId, from, to }, { rejectWithValue }) => {
  try {
    return await socialMediaApi.getAudienceGrowth(orgId, { from, to });
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});
