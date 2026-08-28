import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  fetchAnalyticsOverview,
  fetchAudienceGrowth,
  fetchPlatformAnalytics,
  fetchPostPerformance,
} from "@/features/social-media/socialAnalyticsThunks";
import type {
  AnalyticsOverview,
  AudienceGrowth,
  PlatformAnalytics,
  PostPerformanceItem,
  SocialPlatform,
} from "@/types/social-media.types";

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export type SocialAnalyticsState = {
  overview: AnalyticsOverview | null;
  platformData: Partial<Record<SocialPlatform, PlatformAnalytics>>;
  postPerformance: PostPerformanceItem[];
  audienceGrowth: AudienceGrowth | null;
  dateRange: { from: string; to: string };
  loading: boolean;
  error: string | null;
};

const initialState: SocialAnalyticsState = {
  overview: null,
  platformData: {},
  postPerformance: [],
  audienceGrowth: null,
  dateRange: defaultRange(),
  loading: false,
  error: null,
};

const socialAnalyticsSlice = createSlice({
  name: "socialAnalytics",
  initialState,
  reducers: {
    setAnalyticsDateRange(state, action: PayloadAction<{ from: string; to: string }>) {
      state.dateRange = action.payload;
    },
    clearAnalyticsError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    const pending = (state: SocialAnalyticsState) => {
      state.loading = true;
      state.error = null;
    };
    const rejected = (state: SocialAnalyticsState, action: { payload?: string }) => {
      state.loading = false;
      state.error = action.payload ?? "Failed to load analytics";
    };

    builder
      .addCase(fetchAnalyticsOverview.pending, pending)
      .addCase(fetchAnalyticsOverview.fulfilled, (state, action) => {
        state.loading = false;
        state.overview = action.payload;
      })
      .addCase(fetchAnalyticsOverview.rejected, rejected)
      .addCase(fetchPlatformAnalytics.pending, pending)
      .addCase(fetchPlatformAnalytics.fulfilled, (state, action) => {
        state.loading = false;
        state.platformData[action.payload.platform] = action.payload;
      })
      .addCase(fetchPlatformAnalytics.rejected, rejected)
      .addCase(fetchPostPerformance.pending, pending)
      .addCase(fetchPostPerformance.fulfilled, (state, action) => {
        state.loading = false;
        state.postPerformance = action.payload;
      })
      .addCase(fetchPostPerformance.rejected, rejected)
      .addCase(fetchAudienceGrowth.pending, pending)
      .addCase(fetchAudienceGrowth.fulfilled, (state, action) => {
        state.loading = false;
        state.audienceGrowth = action.payload;
      })
      .addCase(fetchAudienceGrowth.rejected, rejected);
  },
});

export const { setAnalyticsDateRange, clearAnalyticsError } = socialAnalyticsSlice.actions;
export default socialAnalyticsSlice.reducer;

export const selectAnalyticsOverview = (state: { socialAnalytics: SocialAnalyticsState }) =>
  state.socialAnalytics.overview;
export const selectAnalyticsLoading = (state: { socialAnalytics: SocialAnalyticsState }) =>
  state.socialAnalytics.loading;
export const selectAnalyticsError = (state: { socialAnalytics: SocialAnalyticsState }) =>
  state.socialAnalytics.error;
export const selectAnalyticsDateRange = (state: { socialAnalytics: SocialAnalyticsState }) =>
  state.socialAnalytics.dateRange;
export const selectPostPerformance = (state: { socialAnalytics: SocialAnalyticsState }) =>
  state.socialAnalytics.postPerformance;
export const selectAudienceGrowth = (state: { socialAnalytics: SocialAnalyticsState }) =>
  state.socialAnalytics.audienceGrowth;
export const selectPlatformAnalytics =
  (platform: SocialPlatform) => (state: { socialAnalytics: SocialAnalyticsState }) =>
    state.socialAnalytics.platformData[platform] ?? null;
