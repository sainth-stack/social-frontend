import type { RootState } from "@/store";

export const selectAdminOverview = (state: RootState) => state.admin.overview;
export const selectAdminOverviewLoading = (state: RootState) => state.admin.overviewLoading;
export const selectAdminOverviewError = (state: RootState) => state.admin.overviewError;

export const selectAdminAnalytics = (state: RootState) => state.admin.analytics;
export const selectAdminAnalyticsLoading = (state: RootState) => state.admin.analyticsLoading;
export const selectAdminAnalyticsError = (state: RootState) => state.admin.analyticsError;

export const selectAdminUsers = (state: RootState) => state.admin.users;
export const selectAdminUsersTotal = (state: RootState) => state.admin.usersTotal;
export const selectAdminUsersLoading = (state: RootState) => state.admin.usersLoading;
export const selectAdminUsersError = (state: RootState) => state.admin.usersError;

export const selectPricingPlans = (state: RootState) => state.admin.pricingPlans;
export const selectPricingLoading = (state: RootState) => state.admin.pricingLoading;
export const selectPricingSaving = (state: RootState) => state.admin.pricingSaving;
export const selectPricingError = (state: RootState) => state.admin.pricingError;
export const selectPricingIsFallback = (state: RootState) => state.admin.pricingIsFallback;
