"use client";

import { useEffect } from "react";
import { Alert, Box, Grid, Skeleton, Typography } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DateRangeControl from "@/components/social-media/analytics/DateRangeControl";
import ChartCard from "@/components/ui/ChartCard";
import MetricGrid from "@/components/ui/MetricGrid";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { selectUser } from "@/features/auth/authSlice";
import {
  selectAnalyticsDateRange,
  selectAnalyticsError,
  selectAnalyticsLoading,
  selectAudienceGrowth,
} from "@/features/social-media/socialAnalyticsSlice";
import { fetchAudienceGrowth } from "@/features/social-media/socialAnalyticsThunks";
import { chartAxisTick, chartTooltipStyle, colors, surfaceSx } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { PLATFORM_COLORS, PLATFORM_LABELS } from "@/types/social-media.types";

const SERIES = ["facebook", "instagram", "linkedin", "x"] as const;

export default function AudienceGrowth() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";
  const range = useAppSelector(selectAnalyticsDateRange);
  const data = useAppSelector(selectAudienceGrowth);
  const loading = useAppSelector(selectAnalyticsLoading);
  const error = useAppSelector(selectAnalyticsError);

  useEffect(() => {
    if (!orgId) return;
    void dispatch(fetchAudienceGrowth({ orgId, from: range.from, to: range.to }));
  }, [dispatch, orgId, range.from, range.to]);

  const empty =
    !loading &&
    data &&
    data.platformCards.every((c) => c.followers === 0 && c.growth === 0);

  return (
    <Box>
      <PageHeader
        title="Audience Growth"
        subtitle="Follower trends across platforms"
        secondaryAction={<DateRangeControl />}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && !data ? (
        <MetricGrid columns={{ xs: 2, sm: 4 }} sx={{ mb: 3 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={96} />
          ))}
        </MetricGrid>
      ) : (
        <MetricGrid columns={{ xs: 2, sm: 4 }} sx={{ mb: 3 }}>
          {(data?.platformCards ?? []).map((card) => (
            <StatCard
              key={card.platform}
              title={PLATFORM_LABELS[card.platform]}
              value={card.followers.toLocaleString()}
              change={{
                value: `${card.growth >= 0 ? "+" : ""}${card.growth} in range`,
                direction: card.growth >= 0 ? "up" : "down",
              }}
            />
          ))}
        </MetricGrid>
      )}

      {empty ? (
        <Box sx={{ ...surfaceSx, p: 6, textAlign: "center" }}>
          <Typography color="text.secondary">
            Analytics appear after posts are published and accounts are synced.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <ChartCard title="Followers over time" height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.series ?? []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={chartAxisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} width={36} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  {SERIES.map((key) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={PLATFORM_COLORS[key]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <ChartCard title="Net new followers" height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data?.netNewFollowers ?? []}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={chartAxisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="newFollowers" fill={colors.success} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
