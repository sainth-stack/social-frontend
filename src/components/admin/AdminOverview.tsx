"use client";

import { useEffect } from "react";
import PeopleOutlineOutlinedIcon from "@mui/icons-material/PeopleOutlineOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import { Alert, Box } from "@mui/material";

import MetricGrid from "@/components/ui/MetricGrid";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import AppCard from "@/components/ui/AppCard";
import LoadingState from "@/components/ui/LoadingState";
import {
  selectAdminOverview,
  selectAdminOverviewError,
  selectAdminOverviewLoading,
} from "@/features/admin/adminSelectors";
import { fetchAdminOverview } from "@/features/admin/adminThunks";
import { formatCurrencyUsd } from "@/lib/format";
import { colors } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
};

export default function AdminOverview() {
  const dispatch = useAppDispatch();
  const overview = useAppSelector(selectAdminOverview);
  const loading = useAppSelector(selectAdminOverviewLoading);
  const error = useAppSelector(selectAdminOverviewError);

  useEffect(() => {
    void dispatch(fetchAdminOverview());
  }, [dispatch]);

  const maxCount = Math.max(1, ...(overview?.planDistribution ?? []).map((p) => p.count));

  return (
    <Box>
      <PageHeader
        title="Overview"
        subtitle="Platform-wide health across users, workspaces, and AI usage."
      />

      {error ? (
        <Alert severity="warning" sx={{ mb: 2.5 }}>
          {error} — connect the admin API to see live data.
        </Alert>
      ) : null}

      {loading && !overview ? (
        <LoadingState variant="card" />
      ) : (
        <>
          <MetricGrid columns={{ xs: 1, sm: 2, lg: 3 }} sx={{ mb: 2.5 }}>
            <StatCard
              title="Total users"
              value={(overview?.totalUsers ?? 0).toLocaleString()}
              icon={PeopleOutlineOutlinedIcon}
              showIcon
              change={
                overview
                  ? { value: `${overview.userGrowth30dPct >= 0 ? "+" : ""}${overview.userGrowth30dPct.toFixed(1)}% last 30d`, direction: overview.userGrowth30dPct >= 0 ? "up" : "down" }
                  : undefined
              }
            />
            <StatCard
              title="Workspaces"
              value={(overview?.totalWorkspaces ?? 0).toLocaleString()}
              icon={ApartmentOutlinedIcon}
              showIcon
            />
            <StatCard
              title="MRR estimate"
              value={formatCurrencyUsd(overview?.mrrEstimateUsd ?? 0)}
              helperText="From current plan mix"
              icon={PaidOutlinedIcon}
              showIcon
            />
            <StatCard
              title="Posts (30d)"
              value={(overview?.posts30d ?? 0).toLocaleString()}
              icon={ArticleOutlinedIcon}
              showIcon
            />
            <StatCard
              title="AI generations (30d)"
              value={(overview?.aiUsage30d ?? 0).toLocaleString()}
              icon={AutoAwesomeOutlinedIcon}
              showIcon
            />
            <StatCard
              title="Failed publishes (30d)"
              value={(overview?.failedPublishes30d ?? 0).toLocaleString()}
              icon={ErrorOutlineOutlinedIcon}
              showIcon
              trend={overview && overview.failedPublishes30d > 0 ? "down" : "neutral"}
            />
          </MetricGrid>

          <AppCard title="Plan distribution" subtitle="Workspaces by subscription plan">
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {(overview?.planDistribution ?? []).map((row) => (
                <Box key={row.plan}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Box sx={{ fontSize: "0.875rem", fontWeight: 500 }}>
                      {PLAN_LABELS[row.plan] ?? row.plan}
                    </Box>
                    <Box sx={{ fontSize: "0.8125rem", color: colors.textSecondary }}>
                      {row.count.toLocaleString()}
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      height: 8,
                      borderRadius: 999,
                      bgcolor: colors.background,
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        height: "100%",
                        borderRadius: 999,
                        bgcolor: colors.primary,
                        width: `${(row.count / maxCount) * 100}%`,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </Box>
                </Box>
              ))}
              {!overview?.planDistribution?.length ? (
                <Box sx={{ color: colors.textSecondary, fontSize: "0.875rem" }}>
                  No plan data yet.
                </Box>
              ) : null}
            </Box>
          </AppCard>
        </>
      )}
    </Box>
  );
}
