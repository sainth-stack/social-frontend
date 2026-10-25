import apiClient from "@/api/client";
import type { PlanTier } from "@/types/auth";
import type {
  AdminAIUsageFilters,
  AdminAIUsageReport,
  AdminAnalytics,
  AdminOverviewStats,
  AdminUser,
  AdminUserListResponse,
  AdminWorkspace,
  ContactList,
  ContactSubmission,
  CreateAdminUserPayload,
  MarketingAnalytics,
  PricingPlan,
  UpdatePricingPlanPayload,
} from "@/types/admin";

const base = "/api/v1/admin";

export const adminApi = {
  async getAIUsage(params: AdminAIUsageFilters = {}, signal?: AbortSignal): Promise<AdminAIUsageReport> {
    const { data } = await apiClient.get<AdminAIUsageReport>(`${base}/ai-usage`, { params, signal });
    return data;
  },

  async getMarketingAnalytics(signal?: AbortSignal): Promise<MarketingAnalytics> {
    const { data } = await apiClient.get<MarketingAnalytics>(`${base}/marketing-analytics`, { signal });
    return data;
  },

  async listContacts(params: {
    search?: string;
    status?: ContactSubmission["status"];
    page?: number;
    pageSize?: number;
  } = {}, signal?: AbortSignal): Promise<ContactList> {
    const { data } = await apiClient.get<ContactList>(`${base}/contacts`, { params, signal });
    return data;
  },

  async updateContact(id: string, payload: Pick<ContactSubmission, "status">): Promise<ContactSubmission> {
    const { data } = await apiClient.patch<ContactSubmission>(`${base}/contacts/${encodeURIComponent(id)}`, payload);
    return data;
  },

  async getOverview(signal?: AbortSignal): Promise<AdminOverviewStats> {
    const { data } = await apiClient.get<AdminOverviewStats>(`${base}/overview`, { signal });
    return data;
  },

  async getAnalytics(params?: { from?: string; to?: string }, signal?: AbortSignal): Promise<AdminAnalytics> {
    const { data } = await apiClient.get<AdminAnalytics>(`${base}/analytics`, { params, signal });
    return data;
  },

  async listUsers(params?: {
    search?: string;
    plan?: PlanTier;
    status?: string;
    page?: number;
    pageSize?: number;
  }, signal?: AbortSignal): Promise<AdminUserListResponse> {
    const { data } = await apiClient.get<AdminUserListResponse>(`${base}/users`, { params, signal });
    return data;
  },

  async createUser(payload: CreateAdminUserPayload, signal?: AbortSignal): Promise<AdminUser> {
    const { data } = await apiClient.post<AdminUser>(`${base}/users`, {
      email: payload.email,
      password: payload.password,
      name: payload.name,
      workspaceName: payload.workspaceName,
      plan: payload.plan ?? "starter",
      isPlatformAdmin: payload.isPlatformAdmin ?? false,
    }, { signal });
    return data;
  },

  async suspendUser(userId: string, suspended: boolean, signal?: AbortSignal): Promise<AdminUser> {
    const { data } = await apiClient.post<AdminUser>(`${base}/users/${encodeURIComponent(userId)}/suspend`, {
      suspended,
    }, { signal });
    return data;
  },

  async changeUserPlan(userId: string, plan: PlanTier, signal?: AbortSignal): Promise<AdminUser> {
    const { data } = await apiClient.post<AdminUser>(`${base}/users/${encodeURIComponent(userId)}/plan`, { plan }, { signal });
    return data;
  },

  async listWorkspaces(params: { search?: string; limit?: number; offset?: number } = {}, signal?: AbortSignal): Promise<AdminWorkspace[]> {
    const { data } = await apiClient.get<AdminWorkspace[]>(`${base}/workspaces`, { params, signal });
    return data;
  },

  async changeWorkspacePlan(id: string, plan: PlanTier, signal?: AbortSignal): Promise<AdminWorkspace> {
    const { data } = await apiClient.patch<AdminWorkspace>(`${base}/workspaces/${encodeURIComponent(id)}/plan`, { plan }, { signal });
    return data;
  },

  async changeWorkspaceStatus(id: string, isActive: boolean, signal?: AbortSignal): Promise<AdminWorkspace> {
    const { data } = await apiClient.patch<AdminWorkspace>(`${base}/workspaces/${encodeURIComponent(id)}/status`, { is_active: isActive }, { signal });
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
