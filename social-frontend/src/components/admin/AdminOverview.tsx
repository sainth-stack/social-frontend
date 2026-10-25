"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Building2, FileText, LayoutDashboard, RefreshCw, Sparkles, TriangleAlert, Users } from "lucide-react";
import { PageHeader } from "@/components/layouts/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchAdminOverview } from "@/features/admin/adminThunks";
import { selectAccessToken, selectUser } from "@/features/auth/authSlice";
import { getStoredAccessToken } from "@/lib/auth/session";
import { planDisplayName } from "@/lib/plans";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { AdminOverviewStats } from "@/types/admin";

const shortcuts = [
  ["Users", "Manage platform access", "/admin/users"],
  ["Workspaces", "Review workspace plans", "/admin/workspaces"],
  ["Enquiries", "Follow up on contact submissions", "/admin/contacts"],
  ["Analytics", "Explore product and marketing activity", "/admin/analytics"],
  ["AI Usage & Costs", "Separate generation units, provider calls and configured USD estimates", "/admin/ai-usage"],
  ["Plans", "View INR prices and manage allowances", "/admin/pricing"],
  ["Coupons", "Manage offers and redemptions", "/admin/coupons"],
] as const;

export default function AdminOverview() {
  const user = useAppSelector(selectUser);
  const token = useAppSelector(selectAccessToken);
  if (!user?.isPlatformAdmin) return <p role="alert">Platform administrator access is required.</p>;
  return <OverviewContent key={`${user.id}:${token}`} />;
}

function OverviewContent() {
  const dispatch = useAppDispatch();
  const [overview, setOverview] = useState<AdminOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const requestId = useRef(0);
  const busy = useRef(true);
  const session = useRef(getStoredAccessToken());

  useEffect(() => {
    const id = ++requestId.current;
    const request = dispatch(fetchAdminOverview());
    const valid = () => id === requestId.current && session.current === getStoredAccessToken();
    busy.current = true;
    setLoading(true);
    setError(false);
    void request.unwrap().then((data) => {
      if (valid()) setOverview(data);
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

  const kpis = overview ? [
    { label: "Total users", value: overview.totalUsers, detail: "All users", icon: Users },
    { label: "Total workspaces", value: overview.totalWorkspaces, detail: "All workspaces", icon: Building2 },
    { label: "Published posts", value: overview.posts30d, detail: "Last 30 days", icon: FileText },
    { label: "AI generations", value: overview.aiUsage30d, detail: "Text, image and video · last 30 days", icon: Sparkles },
    { label: "Failed publishes", value: overview.failedPublishes30d, detail: "Platform attempts · last 30 days", icon: TriangleAlert },
  ] : [];
  const planTotal = overview?.planDistribution.reduce((total, row) => total + row.count, 0) ?? 0;

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader icon={LayoutDashboard} title="Platform overview" description="A clear view of users and activity across EarnedVoice." />
        <Button variant="outline" disabled={loading} onClick={refresh}><RefreshCw className="mr-2 size-4" aria-hidden />Refresh overview</Button>
      </header>
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm"><p>Overview could not be loaded. {overview ? "Showing previously loaded data; it may be out of date." : "No totals are available."}</p><Button variant="outline" disabled={loading} onClick={refresh}>Retry overview</Button></div>}
      {loading && overview && <p role="status" className="text-sm text-muted-foreground">Refreshing overview… Showing previously loaded data.</p>}
      <div aria-busy={loading} className="space-y-6">
        {loading && !overview ? <div role="status" aria-label="Loading overview" className="space-y-6"><span className="sr-only">Loading overview…</span><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div><Skeleton className="h-64 rounded-xl" /></div> : overview ? <>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
            {kpis.map(({ label, value, detail, icon: Icon }) => <Card key={label}><CardContent className="grid grid-cols-2 items-center gap-x-3 p-4 sm:block sm:p-5"><div className="flex items-start justify-between gap-2"><h2 className="text-sm font-medium text-muted-foreground">{label}</h2><Icon className="size-4 shrink-0 text-primary" aria-hidden /></div><p className="row-span-2 text-right text-2xl font-semibold tracking-tight tabular-nums sm:mt-3 sm:text-left sm:text-3xl">{value.toLocaleString()}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></CardContent></Card>)}
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base"><h2>Workspace plan distribution</h2></CardTitle><CardDescription>Current workspace counts by plan, including inactive workspaces.</CardDescription></CardHeader>
            <CardContent>
              {planTotal === 0 ? <p className="text-sm text-muted-foreground">No workspaces recorded in the plan distribution.</p> : null}
              <dl className="grid gap-6 sm:grid-cols-3">
                {overview.planDistribution.map((row) => (
                  <div key={row.plan} className="grid grid-cols-2 gap-3">
                    <dt className="text-sm font-medium">{planDisplayName(row.plan)}</dt>
                    <dd className="text-right text-sm tabular-nums">{row.count.toLocaleString()} workspaces</dd>
                    <dd className="col-span-2">
                      <div role="meter" aria-valuemin={0} aria-valuemax={Math.max(1, planTotal)} aria-valuenow={row.count} aria-label={`${planDisplayName(row.plan)} workspaces`} className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${planTotal > 0 ? row.count / planTotal * 100 : 0}%` }} />
                      </div>
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </> : null}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base"><h2>Admin shortcuts</h2></CardTitle><CardDescription>Manage the platform or explore the details.</CardDescription></CardHeader>
        <CardContent><nav aria-label="Admin shortcuts" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shortcuts.map(([label, description, href]) => <Link key={href} href={href} className="rounded-lg border border-border p-4 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="text-sm font-semibold text-primary">{label}</span><span className="mt-1 block text-sm text-muted-foreground">{description}</span></Link>)}</nav></CardContent>
      </Card>
    </div>
  );
}
