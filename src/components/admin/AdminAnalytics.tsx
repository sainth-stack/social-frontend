"use client";

import { useEffect } from "react";
import { Alert, Box } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import ChartCard from "@/components/ui/ChartCard";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import {
  selectAdminAnalytics,
  selectAdminAnalyticsError,
  selectAdminAnalyticsLoading,
} from "@/features/admin/adminSelectors";
import { fetchAdminAnalytics } from "@/features/admin/adminThunks";
import { chartAxisTick, chartTooltipStyle, colors } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const PLAN_COLORS: Record<string, string> = {
  starter: colors.textMuted,
  growth: colors.primary,
  enterprise: colors.accent,
};

const PLATFORM_COLORS_FALLBACK = [colors.primary, colors.accent, colors.textMuted, colors.primaryDark];

export default function AdminAnalytics() {
  const dispatch = useAppDispatch();
  const analytics = useAppSelector(selectAdminAnalytics);
  const loading = useAppSelector(selectAdminAnalyticsLoading);
  const error = useAppSelector(selectAdminAnalyticsError);

  useEffect(() => {
    void dispatch(fetchAdminAnalytics());
  }, [dispatch]);

  return (
    <Box>
      <PageHeader title="Analytics" subtitle="Platform-wide publishing activity and plan mix." />

      {error ? (
        <Alert severity="warning" sx={{ mb: 2.5 }}>
          {error} — connect the admin API to see live analytics.
        </Alert>
      ) : null}

      {loading && !analytics ? (
        <LoadingState variant="card" />
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          <ChartCard title="Posts over time" subtitle="Published posts across all workspaces" height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.postsOverTime ?? []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={chartAxisTick} axisLine={false} tickLine={false} />
                <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} width={36} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="posts" name="Posts" stroke={colors.primary} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
              gap: 2.5,
            }}
          >
            <ChartCard title="Plan distribution" subtitle="Active workspaces by plan" height={280}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics?.planDistribution ?? []}
                    dataKey="count"
                    nameKey="plan"
                    innerRadius={60}
                    outerRadius={92}
                    paddingAngle={2}
                  >
                    {(analytics?.planDistribution ?? []).map((entry) => (
                      <Cell key={entry.plan} fill={PLAN_COLORS[entry.plan] ?? colors.primary} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Platform mix" subtitle="Connected accounts by social platform" height={280}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.platformMix ?? []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="platform" tick={chartAxisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} width={36} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="count" name="Accounts" radius={[6, 6, 0, 0]}>
                    {(analytics?.platformMix ?? []).map((entry, index) => (
                      <Cell
                        key={entry.platform}
                        fill={PLATFORM_COLORS_FALLBACK[index % PLATFORM_COLORS_FALLBACK.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </Box>
        </Box>
      )}
    </Box>
  );
}
