"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
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
  selectPlatformAnalytics,
} from "@/features/social-media/socialAnalyticsSlice";
import { fetchPlatformAnalytics } from "@/features/social-media/socialAnalyticsThunks";
import { chartAxisTick, chartTooltipStyle, colors, surfaceSx } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { SocialPlatform } from "@/types/social-media.types";
import { PLATFORM_LABELS } from "@/types/social-media.types";

const PLATFORMS: SocialPlatform[] = ["facebook", "instagram", "linkedin", "x"];

export default function PlatformAnalytics() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";
  const range = useAppSelector(selectAnalyticsDateRange);
  const [platform, setPlatform] = useState<SocialPlatform>("facebook");
  const data = useAppSelector(selectPlatformAnalytics(platform));
  const loading = useAppSelector(selectAnalyticsLoading);
  const error = useAppSelector(selectAnalyticsError);

  useEffect(() => {
    if (!orgId) return;
    void dispatch(
      fetchPlatformAnalytics({
        orgId,
        platform,
        from: range.from,
        to: range.to,
      }),
    );
  }, [dispatch, orgId, platform, range.from, range.to]);

  const empty =
    !loading && data && data.metrics.posts === 0 && data.metrics.reach === 0;

  return (
    <Box>
      <PageHeader
        title="Platform Analytics"
        subtitle={`Deep dive for ${PLATFORM_LABELS[platform]}`}
        secondaryAction={<DateRangeControl />}
      />

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
        {PLATFORMS.map((p) => (
          <Chip
            key={p}
            label={PLATFORM_LABELS[p]}
            clickable
            color={platform === p ? "primary" : "default"}
            onClick={() => setPlatform(p)}
          />
        ))}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && !data ? (
        <MetricGrid columns={{ xs: 2, sm: 3, lg: 5 }} sx={{ mb: 3 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={96} />
          ))}
        </MetricGrid>
      ) : (
        <MetricGrid columns={{ xs: 2, sm: 3, lg: 5 }} sx={{ mb: 3 }}>
          <StatCard title="Posts" value={data?.metrics.posts ?? 0} />
          <StatCard title="Reach" value={(data?.metrics.reach ?? 0).toLocaleString()} />
          <StatCard
            title="Impressions"
            value={(data?.metrics.impressions ?? 0).toLocaleString()}
          />
          <StatCard
            title="Engagements"
            value={(data?.metrics.engagements ?? 0).toLocaleString()}
          />
          <StatCard title="Clicks" value={(data?.metrics.clicks ?? 0).toLocaleString()} />
        </MetricGrid>
      )}

      {empty ? (
        <Box sx={{ ...surfaceSx, p: 6, textAlign: "center" }}>
          <Typography color="text.secondary">
            Analytics appear after posts are published on {PLATFORM_LABELS[platform]}.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <ChartCard title="Performance over time" height={280}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.series ?? []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={chartAxisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} width={36} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Line type="monotone" dataKey="impressions" stroke={colors.primary} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="reach" stroke={colors.success} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="engagement" stroke="#D97706" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="clicks" stroke="#7C3AED" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <ChartCard title="Post types" height={280}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.postTypes ?? []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="type" tick={chartAxisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="count" fill={colors.primary} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
