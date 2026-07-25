import type { PlanTier, SocialPermissionLevel } from "@/types/auth";

export type UserStatus = "active" | "suspended";

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  workspaceId: string;
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
