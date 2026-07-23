import apiClient from "@/api/client";
import type { PlanTier } from "@/types/auth";
import type {
  AdminAnalytics,
  AdminOverviewStats,
  AdminUser,
  AdminUserListResponse,
  PricingPlan,
  UpdatePricingPlanPayload,
} from "@/types/admin";

const base = "/api/v1/admin";

export const adminApi = {
  async getOverview(): Promise<AdminOverviewStats> {
    const { data } = await apiClient.get<AdminOverviewStats>(`${base}/overview`);
    return data;
  },

  async getAnalytics(params?: { from?: string; to?: string }): Promise<AdminAnalytics> {
    const { data } = await apiClient.get<AdminAnalytics>(`${base}/analytics`, { params });
    return data;
  },

  async listUsers(params?: {
    search?: string;
    plan?: PlanTier;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<AdminUserListResponse> {
    const { data } = await apiClient.get<AdminUserListResponse>(`${base}/users`, { params });
    return data;
  },

  async suspendUser(userId: string, suspended: boolean): Promise<AdminUser> {
    const { data } = await apiClient.post<AdminUser>(`${base}/users/${userId}/suspend`, {
      suspended,
    });
    return data;
  },

  async changeUserPlan(userId: string, plan: PlanTier): Promise<AdminUser> {
    const { data } = await apiClient.post<AdminUser>(`${base}/users/${userId}/plan`, { plan });
    return data;
  },

  async listPricingPlans(): Promise<PricingPlan[]> {
    const { data } = await apiClient.get<PricingPlan[]>(`${base}/pricing`);
    return data;
  },

  async updatePricingPlan(
    planId: PlanTier,
    payload: UpdatePricingPlanPayload,
  ): Promise<PricingPlan> {
    const { data } = await apiClient.put<PricingPlan>(`${base}/pricing/${planId}`, payload);
    return data;
  },
};

export default adminApi;
