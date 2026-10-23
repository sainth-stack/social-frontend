import { createAsyncThunk } from "@reduxjs/toolkit";

import adminApi from "@/api/endpoints/admin.api";
import { toApiError } from "@/api/errors";
import type { PlanTier } from "@/types/auth";
import type {
  AdminAnalytics,
  AdminOverviewStats,
  AdminUser,
  AdminUserListResponse,
  CreateAdminUserPayload,
  PricingPlan,
  UpdatePricingPlanPayload,
} from "@/types/admin";

const createAdminThunk = createAsyncThunk.withTypes<{
  rejectValue: string;
  pendingMeta: { sessionUserId?: string };
}>();

const adminThunkOptions = {
  getPendingMeta(_: unknown, { getState }: { getState: () => unknown }) {
    const state = getState() as { auth?: { user?: { id: string } | null } };
    return { sessionUserId: state.auth?.user?.id };
  },
};

export const fetchAdminOverview = createAdminThunk<AdminOverviewStats, void>(
  "admin/fetchOverview",
  async (_, { rejectWithValue, signal }) => {
    try {
      return await adminApi.getOverview(signal);
    } catch (error) {
      return rejectWithValue(toApiError(error).message);
    }
  },
  adminThunkOptions,
);

export const fetchAdminAnalytics = createAdminThunk<
  AdminAnalytics,
  { from?: string; to?: string } | void
>("admin/fetchAnalytics", async (params, { rejectWithValue, signal }) => {
  try {
    return await adminApi.getAnalytics(params ?? undefined, signal);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
}, adminThunkOptions);

export const fetchAdminUsers = createAdminThunk<
  AdminUserListResponse,
  { search?: string; plan?: PlanTier; status?: string; page?: number; pageSize?: number } | void
>("admin/fetchUsers", async (params, { rejectWithValue, signal }) => {
  try {
    return await adminApi.listUsers(params ?? undefined, signal);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
}, adminThunkOptions);

export const createAdminUser = createAdminThunk<
  AdminUser,
  CreateAdminUserPayload
>("admin/createUser", async (payload, { rejectWithValue }) => {
  try {
    return await adminApi.createUser(payload);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
}, adminThunkOptions);

export const suspendAdminUser = createAdminThunk<
  AdminUser,
  { userId: string; suspended: boolean }
>("admin/suspendUser", async ({ userId, suspended }, { rejectWithValue }) => {
  try {
    return await adminApi.suspendUser(userId, suspended);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
}, adminThunkOptions);

export const changeAdminUserPlan = createAdminThunk<
  AdminUser,
  { userId: string; plan: PlanTier }
>("admin/changeUserPlan", async ({ userId, plan }, { rejectWithValue }) => {
  try {
    return await adminApi.changeUserPlan(userId, plan);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
}, adminThunkOptions);

export const fetchPricingPlans = createAdminThunk<PricingPlan[], void>(
  "admin/fetchPricingPlans",
  async (_, { rejectWithValue }) => {
    try {
      return await adminApi.listPricingPlans();
    } catch (error) {
      return rejectWithValue(toApiError(error).message);
    }
  },
  adminThunkOptions,
);

export const updatePricingPlan = createAdminThunk<
  PricingPlan,
  { planId: PlanTier; payload: UpdatePricingPlanPayload }
>("admin/updatePricingPlan", async ({ planId, payload }, { rejectWithValue }) => {
  try {
    return await adminApi.updatePricingPlan(planId, payload);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
}, adminThunkOptions);
