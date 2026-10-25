import type { PlanTier, SocialPermissionLevel } from "@/types/auth";

export type UserStatus = "active" | "suspended";

export type AdminAIUsageFilters = {
  days?: 7 | 30 | 90;
  startDate?: string;
  endDate?: string;
  groupBy?: "user" | "workspace" | "model";
  search?: string;
  kind?: "all" | "text" | "image";
  workspaceId?: string;
  userId?: string;
  page?: number;
  pageSize?: number;
  sort?: "cost" | "count";
  order?: "asc" | "desc";
};

export type AdminAIUsageMetrics = {
  textGenerations: number;
  imageGenerations: number;
  providerCalls: number;
  textProviderCalls: number;
  imageProviderCalls: number;
  providerQuantity: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  pricedCalls: number;
  unpricedCalls: number;
  failedCalls: number;
  filteredCalls: number;
  unattributedCalls: number;
  legacyTextGenerations: number;
  legacyImageGenerations: number;
  estimatedKnownCostUsd: number;
  totalCostUsd: number | null;
  estimatedCostUsd: number | null;
  historicalUnknown: boolean;
};

export type AdminAIUsageItem = AdminAIUsageMetrics & {
  id: string;
  name: string;
  email: string | null;
  userId: string | null;
  workspaceId: string | null;
  modelId: string | null;
};

export type AdminAIUsagePricing = {
  modelId?: string;
  aliasOf?: string;
  region?: string;
  currency?: string;
  inputPerMillionUsd?: number | null;
  outputPerMillionUsd?: number | null;
  cacheReadPerMillionUsd?: number | null;
  cacheWritePerMillionUsd?: number | null;
  imagePerUnitUsd?: number | null;
};

export type AdminAIUsageReport = {
  startDate: string;
  endDate: string;
  currency: "USD";
  costBasis: "configured_estimate";
  groupBy: "user" | "workspace" | "model";
  summary: AdminAIUsageMetrics;
  items: AdminAIUsageItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  daily: (AdminAIUsageMetrics & { date: string })[];
  models: AdminAIUsageItem[];
  pricing: AdminAIUsagePricing[];
  limitations: string[];
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  workspaceId: string | null;
  workspaceName: string;
  plan: PlanTier;
  status: UserStatus;
  socialPermissionLevel: SocialPermissionLevel;
  isPlatformAdmin: boolean;
  createdAt: string;
};

export type AdminUserListResponse = {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AdminWorkspace = {
  id: string;
  name: string;
  plan: PlanTier;
  is_active: boolean;
  owner_email: string | null;
  member_count: number;
  created_at: string;
};

export type CreateAdminUserPayload = {
  name: string;
  email: string;
  password: string;
  workspaceName?: string;
  plan?: PlanTier;
  isPlatformAdmin?: boolean;
};

export type PlanDistributionRow = {
  plan: PlanTier;
  count: number;
};

export type PostsOverTimePoint = {
  date: string;
  posts: number;
};

export type PlatformMixRow = {
  platform: string;
  count: number;
};

export type AdminOverviewStats = {
  totalUsers: number;
  totalWorkspaces: number;
  posts30d: number;
  aiUsage30d: number;
  failedPublishes30d: number;
  mrrEstimateUsd: number;
  userGrowth30dPct: number;
  planDistribution: PlanDistributionRow[];
};

export type AdminAnalytics = {
  postsOverTime: PostsOverTimePoint[];
  planDistribution: PlanDistributionRow[];
  platformMix: PlatformMixRow[];
};

export type MarketingAnalytics = {
  pageViews30d: number;
  signupClicks30d: number;
  contactClicks30d: number;
  contacts30d: number;
  newContacts: number;
  inProgressContacts: number;
  resolvedContacts: number;
  daily: {
    date: string;
    pageViews: number;
    signupClicks: number;
    contactClicks: number;
    contacts: number;
  }[];
};

export type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string;
  status: "new" | "in_progress" | "resolved";
  createdAt: string;
  updatedAt: string;
};

export type ContactList = {
  items: ContactSubmission[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type PlanLimits = {
  accounts: number | null;
  postsPerMonth: number | null;
  aiTextGenerations: number | null;
  aiImageGenerations: number | null;
  aiVideoGenerations: number | null;
  templates: number | null;
  brandVoice: boolean;
  approvalWorkflow: boolean;
};

export type PricingPlan = {
  id: PlanTier;
  name: string;
  tagline: string;
  priceMonthlyUsd: number | null;
  /** INR list price for self-serve checkout (Pro / Growth). */
  priceMonthlyInr?: number | null;
  priceAnnualUsd: number | null;
  isCustom: boolean;
  recommended?: boolean;
  limits: PlanLimits;
};

export type UpdatePricingPlanPayload = Partial<
  Pick<PricingPlan, "priceMonthlyUsd" | "priceAnnualUsd" | "tagline">
> & {
  limits?: Partial<PlanLimits>;
};
