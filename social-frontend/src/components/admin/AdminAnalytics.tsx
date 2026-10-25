"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { ChartNoAxesCombined, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layouts/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { planDisplayName } from "@/lib/plans";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchAdminAnalytics } from "@/features/admin/adminThunks";
import { selectAccessToken, selectUser } from "@/features/auth/authSlice";
import { getStoredAccessToken } from "@/lib/auth/session";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { AdminAnalytics as AnalyticsData } from "@/types/admin";

const PLAN_COLORS: Record<string, string> = {
  starter: "var(--chart-3)",
  growth: "var(--chart-1)",
  enterprise: "var(--chart-2)",
};

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

export default function AdminAnalytics() {
  const user = useAppSelector(selectUser);
  const token = useAppSelector(selectAccessToken);
  if (!user?.isPlatformAdmin) return <p role="alert">Platform administrator access is required.</p>;
  return <AnalyticsContent key={`${user.id}:${token}`} />;
}

function AnalyticsContent() {
  const dispatch = useAppDispatch();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const requestId = useRef(0);
  const busy = useRef(true);
  const session = useRef(getStoredAccessToken());

  useEffect(() => {
    const id = ++requestId.current;
    const request = dispatch(fetchAdminAnalytics());
    const valid = () => id === requestId.current && session.current === getStoredAccessToken();
    busy.current = true;
    setLoading(true);
    setError(false);
    void request.unwrap().then((data) => {
      if (valid()) setAnalytics(data);
    }).catch(() => {
      if (valid()) setError(true);
    }).finally(() => {
      if (valid()) { busy.current = false; setLoading(false); }
    });
    return () => { ++requestId.current; request.abort(); };
  }, [dispatch, revision]);

  function refresh() {
    if (busy.current || session.current !== getStoredAccessToken()) return;
    busy.current = true;
    setLoading(true);
    setRevision((value) => value + 1);
  }

  const planPie = useMemo(
    () =>
      (analytics?.planDistribution ?? []).map((p) => ({
        name: planDisplayName(p.plan),
        value: p.count,
        color: PLAN_COLORS[p.plan] ?? "var(--primary)",
      })),
    [analytics?.planDistribution],
  );

  const platformBars = useMemo(
    () =>
      (analytics?.platformMix ?? []).map((p) => ({
        feature: p.platform,
        accounts: p.count,
      })),
    [analytics?.platformMix],
  );

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader icon={ChartNoAxesCombined} title="Analytics" description="Product activity and marketing events across the platform." />
        <Button className="min-h-11 w-full sm:min-h-0 sm:w-auto" variant="outline" disabled={loading} onClick={refresh}><RefreshCw className="mr-2 size-4" aria-hidden />Refresh product analytics</Button>
      </header>
      <div><h2 className="text-lg font-semibold">Product analytics</h2><p className="mt-1 text-sm text-muted-foreground">Publishing: last 30 days, including today (UTC). Account and workspace counts are current snapshots.</p></div>
      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <p>Product analytics could not be loaded. {analytics ? "Showing previously loaded data; it may be out of date." : "No totals are available."}</p>
          <Button variant="outline" disabled={loading} onClick={refresh}>Retry product analytics</Button>
        </div>
      ) : null}
      {loading && analytics && <p role="status" className="text-sm text-muted-foreground">Refreshing product analytics… Showing previously loaded data.</p>}
      <div aria-busy={loading}>
      {loading && !analytics ? (
        <div role="status" aria-label="Loading product analytics" className="grid gap-6 lg:grid-cols-2"><span className="sr-only">Loading analytics…</span>{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-80 rounded-xl" />)}</div>
      ) : analytics ? (
        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <Card className="min-w-0 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base"><h3>Posts over time</h3></CardTitle>
              <CardDescription>Published posts across all workspaces · last 30 days (UTC).</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.postsOverTime.length === 0 ? <p className="py-8 text-sm text-muted-foreground">No daily publishing data returned for the last 30 days.</p> : <>
              {analytics.postsOverTime.every((day) => day.posts === 0) && <p className="mb-4 text-sm text-muted-foreground">No published posts recorded in the last 30 days.</p>}
              <div aria-hidden="true" className="min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={analytics.postsOverTime} accessibilityLayer={false}>
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
                    allowDecimals={false}
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="linear"
                    dataKey="posts"
                    name="Published posts"
                    isAnimationActive={false}
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              </div>
              <details className="mt-4 rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View daily publishing data</summary><div role="region" aria-label="Daily publishing totals" tabIndex={0} className="mt-3 max-h-80 overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><table className="w-full text-left text-sm"><caption className="sr-only">Published posts in the last 30 days (UTC)</caption><thead><tr><th scope="col" className="p-3">Date (UTC)</th><th scope="col" className="p-3">Published posts</th></tr></thead><tbody>{analytics.postsOverTime.map((day) => <tr key={day.date} className="border-t"><th scope="row" className="p-3 font-normal"><time dateTime={day.date}>{day.date.slice(0, 10)}</time></th><td className="p-3 tabular-nums">{day.posts.toLocaleString()}</td></tr>)}</tbody></table></div></details>
              </>}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-base"><h3>Connected accounts</h3></CardTitle>
              <CardDescription>Currently active accounts by social platform, not a 30-day total.</CardDescription>
            </CardHeader>
            <CardContent>
              {platformBars.every((row) => row.accounts === 0) ? <p className="py-8 text-sm text-muted-foreground">No active connected accounts recorded.</p> : <>
              <div aria-hidden="true" className="min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={platformBars} accessibilityLayer={false}>
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
                    allowDecimals={false}
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="accounts" name="Connected accounts" fill="var(--primary)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
              </div>
              <dl aria-label="Active accounts by platform" className="mt-4 space-y-3">{platformBars.map((row) => <div key={row.feature} className="flex justify-between gap-3 border-t pt-3 text-sm"><dt className="break-words capitalize">{row.feature}</dt><dd className="tabular-nums">{row.accounts.toLocaleString()}</dd></div>)}</dl>
              </>}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-base"><h3>Plan distribution</h3></CardTitle>
              <CardDescription>Current workspace counts by plan, including inactive workspaces.</CardDescription>
            </CardHeader>
            <CardContent>
              {planPie.every((row) => row.value === 0) ? (
                <p className="py-8 text-sm text-muted-foreground">
                  No workspaces recorded in the plan distribution.
                </p>
              ) : (
                <div aria-hidden="true" className="min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart accessibilityLayer={false}>
                    <Pie
                      data={planPie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {planPie.map((p) => (
                        <Cell key={p.name} fill={p.color} />
                      ))}
                    </Pie>
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                </div>
              )}
              {planPie.length > 0 && <dl aria-label="Workspaces by plan" className="mt-4 space-y-3">{planPie.map((row) => <div key={row.name} className="flex justify-between gap-3 border-t pt-3 text-sm"><dt>{row.name}</dt><dd className="tabular-nums">{row.value.toLocaleString()} workspaces</dd></div>)}</dl>}
            </CardContent>
          </Card>
        </div>
      ) : null}
      </div>
    </div>
  );
}
