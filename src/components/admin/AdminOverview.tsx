"use client";

import { useEffect, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
  FileText,
  Loader2,
  Sparkles,
  TrendingUp,
  Users,
  Building2,
  DollarSign,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  selectAdminOverview,
  selectAdminOverviewError,
  selectAdminOverviewLoading,
} from "@/features/admin/adminSelectors";
import { fetchAdminOverview } from "@/features/admin/adminThunks";
import { formatCurrencyUsd } from "@/lib/format";
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

export default function AdminOverview() {
  const dispatch = useAppDispatch();
  const overview = useAppSelector(selectAdminOverview);
  const loading = useAppSelector(selectAdminOverviewLoading);
  const error = useAppSelector(selectAdminOverviewError);

  useEffect(() => {
    void dispatch(fetchAdminOverview());
  }, [dispatch]);

  const planPie = useMemo(
    () =>
      (overview?.planDistribution ?? []).map((p) => ({
        name: PLAN_LABELS[p.plan] ?? p.plan,
        value: p.count,
        color: PLAN_COLORS[p.plan] ?? "var(--primary)",
      })),
    [overview?.planDistribution],
  );

  const growthBars = useMemo(() => {
    const total = overview?.totalUsers ?? 0;
    const pct = overview?.userGrowth30dPct ?? 0;
    const prior = Math.max(0, Math.round(total / (1 + pct / 100)));
    return [
      { month: "Prior", users: prior },
      { month: "Current", users: total },
    ];
  }, [overview?.totalUsers, overview?.userGrowth30dPct]);

  const kpis = [
    {
      label: "Total users",
      value: (overview?.totalUsers ?? 0).toLocaleString(),
      delta: `${(overview?.userGrowth30dPct ?? 0) >= 0 ? "+" : ""}${(overview?.userGrowth30dPct ?? 0).toFixed(1)}%`,
      icon: Users,
    },
    {
      label: "Workspaces",
      value: (overview?.totalWorkspaces ?? 0).toLocaleString(),
      delta: "active",
      icon: Building2,
    },
    {
      label: "Revenue (MRR)",
      value: formatCurrencyUsd(overview?.mrrEstimateUsd ?? 0),
      delta: "est.",
      icon: DollarSign,
    },
    {
      label: "AI generations",
      value: (overview?.aiUsage30d ?? 0).toLocaleString(),
      delta: "30d",
      icon: Sparkles,
    },
    {
      label: "Published posts",
      value: (overview?.posts30d ?? 0).toLocaleString(),
      delta: "30d",
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
        <p className="text-sm text-muted-foreground">
          Live metrics across all OpsBrain AI workspaces.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground">
          {error} — connect the admin API to see live data.
        </div>
      ) : null}

      {loading && !overview ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading overview…
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {kpis.map((k) => (
              <Card key={k.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
                    <k.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold">{k.value}</span>
                    <span className="inline-flex items-center gap-0.5 text-xs text-success">
                      <ArrowUpRight className="h-3 w-3" />
                      {k.delta}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">User growth</CardTitle>
                <CardDescription>
                  Signups trend based on 30-day growth ({overview?.userGrowth30dPct ?? 0}%
                  ).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={growthBars}>
                    <defs>
                      <linearGradient id="grow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
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
                    <Area
                      type="monotone"
                      dataKey="users"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      fill="url(#grow)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Plan distribution</CardTitle>
                <CardDescription>Active subscriptions.</CardDescription>
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

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-base">Activity snapshot</CardTitle>
                <CardDescription>
                  Posts and AI usage in the last 30 days.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={[
                      { label: "Posts", value: overview?.posts30d ?? 0 },
                      { label: "AI gens", value: overview?.aiUsage30d ?? 0 },
                      {
                        label: "Failed",
                        value: overview?.failedPublishes30d ?? 0,
                      },
                    ]}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
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
                    <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {(overview?.failedPublishes30d ?? 0) > 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <TrendingUp className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {overview?.failedPublishes30d} failed publishes
                </span>{" "}
                in the last 30 days — review failed posts for reconnect issues.
              </span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
