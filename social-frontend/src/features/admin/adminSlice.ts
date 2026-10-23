import { createSlice } from "@reduxjs/toolkit";

import {
  changeAdminUserPlan,
  createAdminUser,
  fetchAdminAnalytics,
  fetchAdminOverview,
  fetchAdminUsers,
  fetchPricingPlans,
  suspendAdminUser,
  updatePricingPlan,
} from "@/features/admin/adminThunks";
import { DEFAULT_PRICING_CATALOG } from "@/features/admin/pricingCatalog";
import { hydrateAuth, loginSuccess, logout } from "@/features/auth/authSlice";
import { login, register, validateSession } from "@/features/auth/authThunks";
import { readSession } from "@/lib/auth/session";
import type { AdminAnalytics, AdminOverviewStats, AdminUser, PricingPlan } from "@/types/admin";
import type { User } from "@/types/auth";

export type AdminState = {
  sessionUserId?: string | null;
  overviewRequestId?: string | null;
  analyticsRequestId?: string | null;
  usersRequestId?: string | null;
  pricingRequestId?: string | null;
  userMutationRequestIds?: Record<string, true>;
  pricingMutationRequestIds?: Record<string, true>;
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
  sessionUserId: null,
  overviewRequestId: null,
  analyticsRequestId: null,
  usersRequestId: null,
  pricingRequestId: null,
  userMutationRequestIds: {},
  pricingMutationRequestIds: {},
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

  pricingPlans: [],
  pricingLoading: false,
  pricingSaving: false,
  pricingError: null,
  pricingIsFallback: false,
};

function upsertUser(users: AdminUser[], user: AdminUser): AdminUser[] {
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx === -1) return [user, ...users];
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

function trackSession(state: AdminState, userId?: string) {
  if (!userId) return;
  if (state.sessionUserId && state.sessionUserId !== userId) {
    Object.assign(state, initialState, { userMutationRequestIds: {}, pricingMutationRequestIds: {} });
  }
  state.sessionUserId = userId;
}

function syncSession(state: AdminState, user: User | null) {
  if (!user?.isPlatformAdmin) return { ...initialState };
  trackSession(state, user.id);
}

function startUserMutation(state: AdminState, action: { meta: { requestId: string; sessionUserId?: string } }) {
  trackSession(state, action.meta.sessionUserId);
  state.userMutationRequestIds ??= {};
  state.userMutationRequestIds[action.meta.requestId] = true;
  state.usersError = null;
}

function finishUserMutation(state: AdminState, requestId: string) {
  if (!state.userMutationRequestIds?.[requestId]) return false;
  delete state.userMutationRequestIds[requestId];
  return true;
}

function invalidateUsersRead(state: AdminState) {
  state.usersRequestId = null;
  state.usersLoading = false;
  state.usersError = null;
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
      .addCase(logout, () => ({ ...initialState }))
      .addCase(loginSuccess, (_, action) => ({ ...initialState, sessionUserId: action.payload.user.isPlatformAdmin ? action.payload.user.id : null }))
      .addCase(login.fulfilled, (_, action) => ({ ...initialState, sessionUserId: action.payload.user.isPlatformAdmin ? action.payload.user.id : null }))
      .addCase(register.fulfilled, (_, action) => ({ ...initialState, sessionUserId: action.payload.user.isPlatformAdmin ? action.payload.user.id : null }))
      .addCase(hydrateAuth, (state) => syncSession(state, readSession()?.user ?? null))
      .addCase(validateSession.fulfilled, (state, action) => syncSession(state, action.payload))
      .addCase(validateSession.rejected, () => ({ ...initialState }))
      .addCase(fetchAdminOverview.pending, (state, action) => {
        trackSession(state, action.meta.sessionUserId);
        state.overviewRequestId = action.meta.requestId;
        state.overviewLoading = true;
        state.overviewError = null;
      })
      .addCase(fetchAdminOverview.fulfilled, (state, action) => {
        if (state.overviewRequestId !== action.meta.requestId) return;
        state.overviewRequestId = null;
        state.overviewLoading = false;
        state.overview = action.payload;
      })
      .addCase(fetchAdminOverview.rejected, (state, action) => {
        if (state.overviewRequestId !== action.meta.requestId) return;
        state.overviewRequestId = null;
        state.overviewLoading = false;
        state.overviewError = action.meta.aborted ? null : action.payload ?? "Failed to load overview";
      })

      .addCase(fetchAdminAnalytics.pending, (state, action) => {
        trackSession(state, action.meta.sessionUserId);
        state.analyticsRequestId = action.meta.requestId;
        state.analyticsLoading = true;
        state.analyticsError = null;
      })
      .addCase(fetchAdminAnalytics.fulfilled, (state, action) => {
        if (state.analyticsRequestId !== action.meta.requestId) return;
        state.analyticsRequestId = null;
        state.analyticsLoading = false;
        state.analytics = action.payload;
      })
      .addCase(fetchAdminAnalytics.rejected, (state, action) => {
        if (state.analyticsRequestId !== action.meta.requestId) return;
        state.analyticsRequestId = null;
        state.analyticsLoading = false;
        state.analyticsError = action.meta.aborted ? null : action.payload ?? "Failed to load analytics";
      })

      .addCase(fetchAdminUsers.pending, (state, action) => {
        trackSession(state, action.meta.sessionUserId);
        state.usersRequestId = action.meta.requestId;
        state.usersLoading = true;
        state.usersError = null;
      })
      .addCase(fetchAdminUsers.fulfilled, (state, action) => {
        if (state.usersRequestId !== action.meta.requestId) return;
        state.usersRequestId = null;
        state.usersLoading = false;
        state.users = action.payload.items;
        state.usersTotal = action.payload.total;
      })
      .addCase(fetchAdminUsers.rejected, (state, action) => {
        if (state.usersRequestId !== action.meta.requestId) return;
        state.usersRequestId = null;
        state.usersLoading = false;
        state.usersError = action.meta.aborted ? null : action.payload ?? "Failed to load users";
      })

      .addCase(createAdminUser.pending, startUserMutation)
      .addCase(createAdminUser.fulfilled, (state, action) => {
        if (!finishUserMutation(state, action.meta.requestId)) return;
        invalidateUsersRead(state);
        state.users = upsertUser(state.users, action.payload);
        state.usersTotal += 1;
        state.usersError = null;
      })
      .addCase(createAdminUser.rejected, (state, action) => {
        if (!finishUserMutation(state, action.meta.requestId)) return;
        state.usersError = action.meta.aborted ? null : action.payload ?? "Failed to create user";
      })

      .addCase(suspendAdminUser.pending, startUserMutation)
      .addCase(suspendAdminUser.fulfilled, (state, action) => {
        if (!finishUserMutation(state, action.meta.requestId)) return;
        invalidateUsersRead(state);
        state.users = upsertUser(state.users, action.payload);
      })
      .addCase(suspendAdminUser.rejected, (state, action) => {
        if (!finishUserMutation(state, action.meta.requestId)) return;
        state.usersError = action.meta.aborted ? null : action.payload ?? "Failed to update user";
      })

      .addCase(changeAdminUserPlan.pending, startUserMutation)
      .addCase(changeAdminUserPlan.fulfilled, (state, action) => {
        if (!finishUserMutation(state, action.meta.requestId)) return;
        invalidateUsersRead(state);
        state.users = upsertUser(state.users, action.payload);
      })
      .addCase(changeAdminUserPlan.rejected, (state, action) => {
        if (!finishUserMutation(state, action.meta.requestId)) return;
        state.usersError = action.meta.aborted ? null : action.payload ?? "Failed to change plan";
      })

      .addCase(fetchPricingPlans.pending, (state, action) => {
        trackSession(state, action.meta.sessionUserId);
        state.pricingRequestId = action.meta.requestId;
        state.pricingLoading = true;
        state.pricingError = null;
      })
      .addCase(fetchPricingPlans.fulfilled, (state, action) => {
        if (state.pricingRequestId !== action.meta.requestId) return;
        state.pricingRequestId = null;
        state.pricingLoading = false;
        state.pricingIsFallback = false;
        state.pricingPlans = action.payload;
      })
      .addCase(fetchPricingPlans.rejected, (state, action) => {
        if (state.pricingRequestId !== action.meta.requestId) return;
        state.pricingRequestId = null;
        state.pricingLoading = false;
        if (action.meta.aborted) {
          state.pricingError = null;
          return;
        }
        state.pricingError = action.payload ?? "Failed to load pricing";
        if (state.pricingPlans.length === 0) {
          state.pricingIsFallback = true;
          state.pricingPlans = DEFAULT_PRICING_CATALOG;
        }
      })

      .addCase(updatePricingPlan.pending, (state, action) => {
        trackSession(state, action.meta.sessionUserId);
        state.pricingMutationRequestIds ??= {};
        state.pricingMutationRequestIds[action.meta.requestId] = true;
        state.pricingSaving = true;
        state.pricingError = null;
      })
      .addCase(updatePricingPlan.fulfilled, (state, action) => {
        if (!state.pricingMutationRequestIds?.[action.meta.requestId]) return;
        delete state.pricingMutationRequestIds[action.meta.requestId];
        state.pricingSaving = Object.keys(state.pricingMutationRequestIds).length > 0;
        state.pricingRequestId = null;
        state.pricingLoading = false;
        state.pricingError = null;
        state.pricingIsFallback = false;
        state.pricingPlans = upsertPlan(state.pricingPlans, action.payload);
      })
      .addCase(updatePricingPlan.rejected, (state, action) => {
        if (!state.pricingMutationRequestIds?.[action.meta.requestId]) return;
        delete state.pricingMutationRequestIds[action.meta.requestId];
        state.pricingSaving = Object.keys(state.pricingMutationRequestIds).length > 0;
        state.pricingError = action.meta.aborted ? null : action.payload ?? "Failed to save plan";
      });
  },
});

export const { clearAdminErrors } = adminSlice.actions;
export default adminSlice.reducer;
