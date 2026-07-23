import { createSlice } from "@reduxjs/toolkit";

import {
  changeAdminUserPlan,
  fetchAdminAnalytics,
  fetchAdminOverview,
  fetchAdminUsers,
  fetchPricingPlans,
  suspendAdminUser,
  updatePricingPlan,
} from "@/features/admin/adminThunks";
import { DEFAULT_PRICING_CATALOG } from "@/features/admin/pricingCatalog";
import type { AdminAnalytics, AdminOverviewStats, AdminUser, PricingPlan } from "@/types/admin";

export type AdminState = {
  overview: AdminOverviewStats | null;
  overviewLoading: boolean;
  overviewError: string | null;

  analytics: AdminAnalytics | null;
  analyticsLoading: boolean;
  analyticsError: string | null;

  users: AdminUser[];
  usersTotal: number;
  usersLoading: boolean;
  usersError: string | null;

  pricingPlans: PricingPlan[];
  pricingLoading: boolean;
  pricingSaving: boolean;
  pricingError: string | null;
  pricingIsFallback: boolean;
};

const initialState: AdminState = {
  overview: null,
  overviewLoading: false,
  overviewError: null,

  analytics: null,
  analyticsLoading: false,
  analyticsError: null,

  users: [],
  usersTotal: 0,
  usersLoading: false,
  usersError: null,

  // Starts empty — the pricing tab always hits `GET /admin/pricing` first.
  // `DEFAULT_PRICING_CATALOG` is only used as a last-resort fallback if that
  // request fails and we have nothing else to show (see `fetchPricingPlans.rejected`).
  pricingPlans: [],
  pricingLoading: false,
  pricingSaving: false,
  pricingError: null,
  pricingIsFallback: false,
};

function upsertUser(users: AdminUser[], user: AdminUser): AdminUser[] {
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx === -1) return users;
  const next = [...users];
  next[idx] = user;
  return next;
}

function upsertPlan(plans: PricingPlan[], plan: PricingPlan): PricingPlan[] {
  const idx = plans.findIndex((p) => p.id === plan.id);
  if (idx === -1) return [...plans, plan];
  const next = [...plans];
  next[idx] = plan;
  return next;
}

const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {
    clearAdminErrors(state) {
      state.overviewError = null;
      state.analyticsError = null;
      state.usersError = null;
      state.pricingError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminOverview.pending, (state) => {
        state.overviewLoading = true;
        state.overviewError = null;
      })
      .addCase(fetchAdminOverview.fulfilled, (state, action) => {
        state.overviewLoading = false;
        state.overview = action.payload;
      })
      .addCase(fetchAdminOverview.rejected, (state, action) => {
        state.overviewLoading = false;
        state.overviewError = action.payload ?? "Failed to load overview";
      })

      .addCase(fetchAdminAnalytics.pending, (state) => {
        state.analyticsLoading = true;
        state.analyticsError = null;
      })
      .addCase(fetchAdminAnalytics.fulfilled, (state, action) => {
        state.analyticsLoading = false;
        state.analytics = action.payload;
      })
      .addCase(fetchAdminAnalytics.rejected, (state, action) => {
        state.analyticsLoading = false;
        state.analyticsError = action.payload ?? "Failed to load analytics";
      })

      .addCase(fetchAdminUsers.pending, (state) => {
        state.usersLoading = true;
        state.usersError = null;
      })
      .addCase(fetchAdminUsers.fulfilled, (state, action) => {
        state.usersLoading = false;
        state.users = action.payload.items;
        state.usersTotal = action.payload.total;
      })
      .addCase(fetchAdminUsers.rejected, (state, action) => {
        state.usersLoading = false;
        state.usersError = action.payload ?? "Failed to load users";
      })

      .addCase(suspendAdminUser.fulfilled, (state, action) => {
        state.users = upsertUser(state.users, action.payload);
      })
      .addCase(suspendAdminUser.rejected, (state, action) => {
        state.usersError = action.payload ?? "Failed to update user";
      })

      .addCase(changeAdminUserPlan.fulfilled, (state, action) => {
        state.users = upsertUser(state.users, action.payload);
      })
      .addCase(changeAdminUserPlan.rejected, (state, action) => {
        state.usersError = action.payload ?? "Failed to change plan";
      })

      .addCase(fetchPricingPlans.pending, (state) => {
        state.pricingLoading = true;
        state.pricingError = null;
      })
      .addCase(fetchPricingPlans.fulfilled, (state, action) => {
        state.pricingLoading = false;
        state.pricingIsFallback = false;
        state.pricingPlans = action.payload;
      })
      .addCase(fetchPricingPlans.rejected, (state, action) => {
        state.pricingLoading = false;
        state.pricingError = action.payload ?? "Failed to load pricing";
        if (state.pricingPlans.length === 0) {
          // Last resort only — nothing loaded yet and the API call failed.
          state.pricingIsFallback = true;
          state.pricingPlans = DEFAULT_PRICING_CATALOG;
        }
      })

      .addCase(updatePricingPlan.pending, (state) => {
        state.pricingSaving = true;
        state.pricingError = null;
      })
      .addCase(updatePricingPlan.fulfilled, (state, action) => {
        state.pricingSaving = false;
        state.pricingIsFallback = false;
        state.pricingPlans = upsertPlan(state.pricingPlans, action.payload);
      })
      .addCase(updatePricingPlan.rejected, (state, action) => {
        state.pricingSaving = false;
        state.pricingError = action.payload ?? "Failed to save plan";
      });
  },
});

export const { clearAdminErrors } = adminSlice.actions;
export default adminSlice.reducer;
