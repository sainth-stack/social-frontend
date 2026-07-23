import { createAsyncThunk } from "@reduxjs/toolkit";

import adminApi from "@/api/endpoints/admin.api";
import { toApiError } from "@/api/errors";
import type { PlanTier } from "@/types/auth";
import type {
  AdminAnalytics,
  AdminOverviewStats,
  AdminUser,
  AdminUserListResponse,
  PricingPlan,
  UpdatePricingPlanPayload,
} from "@/types/admin";

export const fetchAdminOverview = createAsyncThunk<AdminOverviewStats, void, { rejectValue: string }>(
  "admin/fetchOverview",
  async (_, { rejectWithValue }) => {
    try {
      return await adminApi.getOverview();
    } catch (error) {
      return rejectWithValue(toApiError(error).message);
    }
  },
);

export const fetchAdminAnalytics = createAsyncThunk<
  AdminAnalytics,
  { from?: string; to?: string } | void,
  { rejectValue: string }
>("admin/fetchAnalytics", async (params, { rejectWithValue }) => {
  try {
    return await adminApi.getAnalytics(params ?? undefined);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const fetchAdminUsers = createAsyncThunk<
  AdminUserListResponse,
  { search?: string; plan?: PlanTier; status?: string; page?: number; pageSize?: number } | void,
  { rejectValue: string }
>("admin/fetchUsers", async (params, { rejectWithValue }) => {
  try {
    return await adminApi.listUsers(params ?? undefined);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const suspendAdminUser = createAsyncThunk<
  AdminUser,
  { userId: string; suspended: boolean },
  { rejectValue: string }
>("admin/suspendUser", async ({ userId, suspended }, { rejectWithValue }) => {
  try {
    return await adminApi.suspendUser(userId, suspended);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const changeAdminUserPlan = createAsyncThunk<
  AdminUser,
  { userId: string; plan: PlanTier },
  { rejectValue: string }
>("admin/changeUserPlan", async ({ userId, plan }, { rejectWithValue }) => {
  try {
    return await adminApi.changeUserPlan(userId, plan);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const fetchPricingPlans = createAsyncThunk<PricingPlan[], void, { rejectValue: string }>(
  "admin/fetchPricingPlans",
  async (_, { rejectWithValue }) => {
    try {
      return await adminApi.listPricingPlans();
    } catch (error) {
      return rejectWithValue(toApiError(error).message);
    }
  },
);

export const updatePricingPlan = createAsyncThunk<
  PricingPlan,
  { planId: PlanTier; payload: UpdatePricingPlanPayload },
  { rejectValue: string }
>("admin/updatePricingPlan", async ({ planId, payload }, { rejectWithValue }) => {
  try {
    return await adminApi.updatePricingPlan(planId, payload);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});
