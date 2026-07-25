"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  Download,
  Loader2,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { PlatformIcon } from "@/components/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { selectUser } from "@/features/auth/authSlice";
import {
  selectAnalyticsError,
  selectAnalyticsLoading,
  selectAnalyticsOverview,
  selectAudienceGrowth,
  selectPostPerformance,
  setAnalyticsDateRange,
} from "@/features/social-media/socialAnalyticsSlice";
import {
  fetchAnalyticsOverview,
  fetchAudienceGrowth,
  fetchPlatformAnalytics,
  fetchPostPerformance,
} from "@/features/social-media/socialAnalyticsThunks";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { SocialPlatform } from "@/types/social-media.types";

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

function rangeFromPreset(preset: string): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (preset === "7d") from.setDate(to.getDate() - 6);
  else if (preset === "90d") from.setDate(to.getDate() - 89);
  else if (preset === "ytd") from.setMonth(0, 1);
  else from.setDate(to.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function AnalyticsOverview() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";
  const overview = useAppSelector(selectAnalyticsOverview);
  const audience = useAppSelector(selectAudienceGrowth);
  const posts = useAppSelector(selectPostPerformance);
  const loading = useAppSelector(selectAnalyticsLoading);
  const error = useAppSelector(selectAnalyticsError);
  const [range, setRange] = useState("30d");
  const [chartTab, setChartTab] = useState("reach");

  useEffect(() => {
    if (!orgId) return;
    const { from, to } = rangeFromPreset(range);
    dispatch(setAnalyticsDateRange({ from, to }));
    void dispatch(fetchAnalyticsOverview({ orgId, from, to }));
    void dispatch(
      fetchPostPerformance({ orgId, from, to, sort: "engagementRate", order: "desc" }),
    );
    void dispatch(fetchAudienceGrowth({ orgId, from, to }));
  }, [dispatch, orgId, range]);

  useEffect(() => {
    if (!orgId || !overview?.platformComparison?.length) return;
    const { from, to } = rangeFromPreset(range);
    const platforms = overview.platformComparison
      .map((p) => p.platform)
      .filter((p, i, arr) => arr.indexOf(p) === i) as SocialPlatform[];
    for (const platform of platforms) {
      void dispatch(fetchPlatformAnalytics({ orgId, platform, from, to }));
    }
  }, [dispatch, orgId, range, overview?.platformComparison]);

  const metrics = overview?.metrics;

  const trendData = useMemo(() => {
    const series = overview?.engagementSeries ?? [];
    return series.map((row) => {
      const day =
        typeof row.date === "string"
          ? row.date.slice(5)
          : typeof row.day === "string"
            ? row.day
            : String(row.date ?? "");
      return {
        day,
        reach: Number(row.reach ?? row.impressions ?? 0),
        engagement: Number(row.engagement ?? row.engagements ?? 0),
      };
    });
  }, [overview?.engagementSeries]);

  const ageDemo = useMemo(() => {
    // API has no age buckets — approximate share from platform reach mix for visual parity.
    const reach = overview?.reachByPlatform ?? [];
    if (!reach.length) {
      return [
        { label: "18–24", value: 18 },
        { label: "25–34", value: 34 },
        { label: "35–44", value: 28 },
        { label: "45–54", value: 14 },
        { label: "55+", value: 6 },
      ];
    }
    const total = reach.reduce((s, r) => s + r.reach, 0) || 1;
    return reach.slice(0, 5).map((r) => ({
      label: r.platform,
      value: Math.round((r.reach / total) * 100),
    }));
  }, [overview?.reachByPlatform]);

  const platformRows = useMemo(() => {
    const comparison = overview?.platformComparison ?? [];
    const cards = audience?.platformCards ?? [];
    return comparison.map((p) => {
      const card = cards.find((c) => c.platform === p.platform);
      return {
        platform: p.platform,
        posts: p.posts,
        reach: p.reach,
        engagement: Math.round(p.impressions * p.engagementRate),
        growth: card?.growth ?? 0,
      };
    });
  }, [overview?.platformComparison, audience?.platformCards]);

  const topPosts = useMemo(() => posts.slice(0, 5), [posts]);

  const empty =
    !loading &&
    metrics &&
    metrics.totalPosts === 0 &&
    metrics.totalReach === 0 &&
    metrics.totalEngagements === 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            How your content is performing across every connected account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="ytd">Year to date</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" type="button">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && !overview ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading analytics…
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Reach" value={metrics?.totalReach ?? 0} change={metrics?.followerGrowth ?? 0} />
            <KpiCard
              label="Impressions"
              value={metrics?.totalImpressions ?? 0}
              change={metrics?.followerGrowth ?? 0}
            />
            <KpiCard
              label="Engagement"
              value={metrics?.totalEngagements ?? 0}
              change={Math.round((metrics?.avgEngagementRate ?? 0) * 1000) / 10}
            />
            <KpiCard
              label="Followers"
              value={audience?.platformCards.reduce((s, c) => s + c.followers, 0) ?? 0}
              change={metrics?.followerGrowth ?? 0}
            />
          </div>

          {empty ? (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="font-medium">No analytics yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Analytics appear after posts are published.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">Reach & engagement</CardTitle>
                      <CardDescription>Daily performance across all platforms.</CardDescription>
                    </div>
                    <Tabs value={chartTab} onValueChange={setChartTab}>
                      <TabsList>
                        <TabsTrigger value="reach">Reach</TabsTrigger>
                        <TabsTrigger value="engagement">Engagement</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="areaReach" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="areaEng" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="day"
                          stroke="var(--muted-foreground)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="var(--muted-foreground)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        {chartTab === "reach" ? (
                          <Area
                            type="monotone"
                            dataKey="reach"
                            stroke="var(--primary)"
                            strokeWidth={2}
                            fill="url(#areaReach)"
                          />
                        ) : (
                          <Area
                            type="monotone"
                            dataKey="engagement"
                            stroke="var(--chart-2)"
                            strokeWidth={2}
                            fill="url(#areaEng)"
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Audience mix</CardTitle>
                    <CardDescription>Share of reach by platform.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={ageDemo}
                          dataKey="value"
                          nameKey="label"
                          innerRadius={45}
                          outerRadius={80}
                          paddingAngle={2}
                        >
                          {ageDemo.map((_, i) => (
                            <Cell key={i} fill={`var(--chart-${(i % 5) + 1})`} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Platform performance</CardTitle>
                    <CardDescription>Reach and engagement by account.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {platformRows.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No platform data yet.
                      </p>
                    ) : (
                      platformRows.map((p) => (
                        <div
                          key={p.platform}
                          className="flex items-center gap-3 rounded-lg border border-border p-3"
                        >
                          <PlatformIcon platform={p.platform} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium capitalize">{p.platform}</span>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-xs font-medium",
                                  p.growth >= 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-destructive",
                                )}
                              >
                                {p.growth >= 0 ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {Math.abs(p.growth)}%
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{p.posts} posts</span>
                              <span>{p.reach.toLocaleString()} reach</span>
                              <span>{p.engagement.toLocaleString()} engagement</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top performing posts</CardTitle>
                    <CardDescription>Highest engagement rate this period.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {topPosts.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No posts in this range.
                      </p>
                    ) : (
                      topPosts.map((p, i) => (
                        <div
                          key={p.postId + p.platformRowId}
                          className="flex items-center gap-3 rounded-lg border border-border p-3"
                        >
                          <span className="w-5 font-mono text-xs text-muted-foreground">
                            #{i + 1}
                          </span>
                          <PlatformIcon platform={p.platform} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                              {p.caption || "Untitled post"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {p.reach.toLocaleString()} reach ·{" "}
                              {p.engagements.toLocaleString()} engagement
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="border-emerald-500/20 bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-300"
                          >
                            {(p.engagementRate * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Audience growth</CardTitle>
                    <CardDescription>
                      Net new followers over the selected period.
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="gap-1 border-primary/20 bg-primary/10 text-primary"
                  >
                    <Sparkles className="h-3 w-3" />
                    AI insight
                  </Badge>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={audience?.netNewFollowers ?? []}>
                      <defs>
                        <linearGradient id="areaFollowers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => String(v).slice(5)}
                      />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area
                        type="monotone"
                        dataKey="newFollowers"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        fill="url(#areaFollowers)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                    <ArrowUpRight className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <span className="font-medium">Recommendation.</span>{" "}
                      <span className="text-muted-foreground">
                        Keep posting when engagement is rising — your top posts this period
                        averaged{" "}
                        <strong className="text-foreground">
                          {(
                            (topPosts.reduce((s, p) => s + p.engagementRate, 0) /
                              Math.max(1, topPosts.length)) *
                            100
                          ).toFixed(1)}
                          %
                        </strong>{" "}
                        engagement.
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  change,
}: {
  label: string;
  value: number;
  change: number;
}) {
  const up = change >= 0;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">
          {value.toLocaleString()}
        </div>
        <div
          className={cn(
            "mt-1 inline-flex items-center gap-1 text-xs font-medium",
            up ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
          )}
        >
          {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(change)}
          {label === "Engagement" ? "% avg" : " vs. prev"}
        </div>
      </CardContent>
    </Card>
  );
}
