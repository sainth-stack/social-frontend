"use client";

import { useEffect } from "react";
import { Alert, Box, Grid, Skeleton, Typography } from "@mui/material";

import DateRangeControl from "@/components/social-media/analytics/DateRangeControl";
import EngagementChart from "@/components/social-media/analytics/EngagementChart";
import PlatformComparisonTable from "@/components/social-media/analytics/PlatformComparisonTable";
import ReachChart from "@/components/social-media/analytics/ReachChart";
import MetricGrid from "@/components/ui/MetricGrid";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { selectUser } from "@/features/auth/authSlice";
import {
  selectAnalyticsDateRange,
  selectAnalyticsError,
  selectAnalyticsLoading,
  selectAnalyticsOverview,
} from "@/features/social-media/socialAnalyticsSlice";
import { fetchAnalyticsOverview } from "@/features/social-media/socialAnalyticsThunks";
import { surfaceSx } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

export default function AnalyticsOverview() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";
  const range = useAppSelector(selectAnalyticsDateRange);
  const overview = useAppSelector(selectAnalyticsOverview);
  const loading = useAppSelector(selectAnalyticsLoading);
  const error = useAppSelector(selectAnalyticsError);

  useEffect(() => {
    if (!orgId) return;
    void dispatch(
      fetchAnalyticsOverview({ orgId, from: range.from, to: range.to }),
    );
  }, [dispatch, orgId, range.from, range.to]);

  const metrics = overview?.metrics;
  const empty =
    !loading &&
    metrics &&
    metrics.totalPosts === 0 &&
    metrics.totalReach === 0 &&
    metrics.totalEngagements === 0;

  return (
    <Box>
      <PageHeader
        title="Analytics"
        subtitle="Cross-platform performance summary"
        secondaryAction={<DateRangeControl />}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && !overview ? (
        <MetricGrid columns={{ xs: 2, sm: 3, lg: 6 }} sx={{ mb: 3 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={96} />
          ))}
        </MetricGrid>
      ) : (
        <MetricGrid columns={{ xs: 2, sm: 3, lg: 6 }} sx={{ mb: 3 }}>
          <StatCard title="Total Posts" value={metrics?.totalPosts ?? 0} />
          <StatCard title="Total Reach" value={(metrics?.totalReach ?? 0).toLocaleString()} />
          <StatCard
            title="Impressions"
            value={(metrics?.totalImpressions ?? 0).toLocaleString()}
          />
          <StatCard
            title="Engagements"
            value={(metrics?.totalEngagements ?? 0).toLocaleString()}
          />
          <StatCard
            title="Avg Eng. Rate"
            value={`${((metrics?.avgEngagementRate ?? 0) * 100).toFixed(1)}%`}
          />
          <StatCard
            title="Follower Growth"
            value={metrics?.followerGrowth ?? 0}
            change={{
              value: "in range",
              direction: (metrics?.followerGrowth ?? 0) >= 0 ? "up" : "down",
            }}
          />
        </MetricGrid>
      )}

      {empty ? (
        <Box sx={{ ...surfaceSx, p: 6, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>No analytics yet</Typography>
          <Typography color="text.secondary">
            Analytics appear after posts are published.
          </Typography>
        </Box>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 12, lg: 7 }}>
              {loading && !overview ? (
                <Skeleton variant="rounded" height={280} />
              ) : (
                <EngagementChart data={overview?.engagementSeries ?? []} />
              )}
            </Grid>
            <Grid size={{ xs: 12, lg: 5 }}>
              {loading && !overview ? (
                <Skeleton variant="rounded" height={280} />
              ) : (
                <ReachChart data={overview?.reachByPlatform ?? []} />
              )}
            </Grid>
          </Grid>
          <PlatformComparisonTable rows={overview?.platformComparison ?? []} />
        </>
      )}
    </Box>
  );
}
