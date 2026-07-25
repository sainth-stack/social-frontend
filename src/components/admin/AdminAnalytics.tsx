"use client";

import { useEffect, useMemo } from "react";
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
import { Loader2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  selectAdminAnalytics,
  selectAdminAnalyticsError,
  selectAdminAnalyticsLoading,
} from "@/features/admin/adminSelectors";
import { fetchAdminAnalytics } from "@/features/admin/adminThunks";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const PLAN_COLORS: Record<string, string> = {
  starter: "var(--chart-3)",
  growth: "var(--chart-1)",
  enterprise: "var(--chart-2)",
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Free",
  growth: "Pro",
  enterprise: "Growth",
};

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

export default function AdminAnalytics() {
  const dispatch = useAppDispatch();
  const analytics = useAppSelector(selectAdminAnalytics);
  const loading = useAppSelector(selectAdminAnalyticsLoading);
  const error = useAppSelector(selectAdminAnalyticsError);

  useEffect(() => {
    void dispatch(fetchAdminAnalytics());
  }, [dispatch]);

  const planPie = useMemo(
    () =>
      (analytics?.planDistribution ?? []).map((p) => ({
        name: PLAN_LABELS[p.plan] ?? p.plan,
        value: p.count,
        color: PLAN_COLORS[p.plan] ?? "var(--primary)",
      })),
    [analytics?.planDistribution],
  );

  const platformBars = useMemo(
    () =>
      (analytics?.platformMix ?? []).map((p) => ({
        feature: p.platform,
        value: p.count,
      })),
    [analytics?.platformMix],
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Product and publishing trends across the platform.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
          {error} — connect the admin API to see live analytics.
        </div>
      ) : null}

      {loading && !analytics ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading analytics…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Posts over time</CardTitle>
              <CardDescription>Published posts across all workspaces.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={analytics?.postsOverTime ?? []}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => String(v).slice(5)}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="posts"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platform mix</CardTitle>
              <CardDescription>Connected accounts by social platform.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={platformBars}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="feature"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connected accounts</CardTitle>
              <CardDescription>Count of accounts per platform.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={platformBars} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="feature"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plan distribution</CardTitle>
              <CardDescription>Subscribers per plan.</CardDescription>
            </CardHeader>
            <CardContent>
              {planPie.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  No plan data yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={planPie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {planPie.map((p) => (
                        <Cell key={p.name} fill={p.color} />
                      ))}
                    </Pie>
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
