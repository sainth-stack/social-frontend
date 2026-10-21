"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Image as ImageIcon,
  LayoutTemplate,
  Lightbulb,
  Link2,
  Send,
  Users,
} from "lucide-react";

import { ProductDashboardIcon, ProductGenerateIcon } from "@/components/icons/product-icons";
import { PageHeader } from "@/components/layouts/PageHeader";
import { PlatformIcon } from "@/components/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { selectUser } from "@/features/auth/authSlice";
import { RecentActivityFeed } from "@/components/social-media/dashboard/RecentActivityFeed";
import { useDashboardHome } from "@/hooks/useDashboardHome";
import { PLAN_DISPLAY_NAMES } from "@/lib/plans";
import { useAppSelector } from "@/store/hooks";
import type { SocialPlatform } from "@/types/social-media.types";

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <Card className="border-border/80 shadow-soft">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            {loading ? (
              <Skeleton className="mt-2 h-9 w-24" />
            ) : (
              <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
            )}
            {hint && !loading ? (
              <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            ) : null}
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function UsageRow({
  icon: Icon,
  label,
  used,
  limit,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  used: number;
  limit: number | null;
}) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className="font-medium tabular-nums">
          {used} / {limit == null ? "∞" : limit}
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function planLabel(plan?: string) {
  if (!plan) return "Free";
  return PLAN_DISPLAY_NAMES[String(plan).toLowerCase()] ?? plan;
}

export default function SocialDashboard() {
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId;
  const { data, loading, error, reload } = useDashboardHome(orgId);

  const stats = data?.stats;
  const activity = data?.activity ?? [];
  const recs = data?.recommendations ?? [];
  const upcoming = data?.scheduledPosts ?? [];
  const usage = stats?.usage;
  const firstName = user?.name?.split(" ")[0] || "there";
  const postsLeft =
    usage?.postsThisMonth.limit != null
      ? Math.max(0, usage.postsThisMonth.limit - usage.postsThisMonth.used)
      : null;
  const expiredAccounts = stats?.expiredAccounts ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        icon={ProductDashboardIcon}
        title="Dashboard"
        description="Overview of publishing, schedule, and workspace health."
      />

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground shadow-elevated">
        <div className="p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-wider text-primary-foreground/75">
                {greeting()}, {firstName}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                Your social command center
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-primary-foreground/85">
                {planLabel(usage?.plan ?? user?.plan)} plan
                {postsLeft != null ? ` · ${postsLeft} posts left this month` : null}
                {stats != null ? ` · ${stats.connectedAccounts} connected accounts` : null}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" className="shadow-sm" asChild>
                <Link href="/dashboard/content-studio/generate">
                  <ProductGenerateIcon className="mr-1.5 h-4 w-4" /> Generate
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-white/25 bg-white/10 text-primary-foreground hover:bg-white/20"
                asChild
              >
                <Link href="/dashboard/calendar">
                  <CalendarClock className="mr-1.5 h-4 w-4" /> Calendar
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-white/25 bg-white/10 text-primary-foreground hover:bg-white/20"
                asChild
              >
                <Link href="/dashboard/accounts">
                  <Link2 className="mr-1.5 h-4 w-4" /> Accounts
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={reload}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!loading && (stats?.connectedAccounts ?? 0) === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Connect a social account to get started</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Facebook, Instagram, LinkedIn, and X — publish from one workspace.
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/accounts">Connect accounts</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {expiredAccounts > 0 && !loading ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              <span className="font-medium">{expiredAccounts} account(s)</span> need reconnecting
              to keep publishing.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/accounts">Fix connections</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Posts this week"
          value={stats?.postsThisWeek ?? 0}
          hint="Published and scheduled"
          icon={Send}
          loading={loading}
        />
        <KpiCard
          label="Scheduled"
          value={upcoming.length}
          hint="Next in queue"
          icon={CalendarClock}
          loading={loading}
        />
        <KpiCard
          label="Reach (30d)"
          value={(stats?.totalReach ?? 0).toLocaleString()}
          hint={`${((stats?.avgEngagementRate ?? 0) * 100).toFixed(1)}% avg. engagement`}
          icon={BarChart3}
          loading={loading}
        />
        <KpiCard
          label="Accounts"
          value={stats?.connectedAccounts ?? 0}
          hint={expiredAccounts ? `${expiredAccounts} need attention` : "All connections healthy"}
          icon={Users}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base">Upcoming posts</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Scheduled across your channels</p>
            </div>
            <Button variant="ghost" size="sm" className="text-primary" asChild>
              <Link href="/dashboard/posts/scheduled">
                View all <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))
            ) : upcoming.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
                <Button className="mt-3" size="sm" asChild>
                  <Link href="/dashboard/content-studio/generate">Create a post</Link>
                </Button>
              </div>
            ) : (
              upcoming.map((p) => {
                const platform = (p.platforms[0]?.platform ?? "linkedin") as SocialPlatform;
                return (
                  <Link
                    key={p.id}
                    href={`/dashboard/posts/${p.id}`}
                    className="flex items-start gap-4 rounded-xl border border-border/80 bg-card p-4 transition-colors hover:bg-muted/40"
                  >
                    <PlatformIcon platform={platform} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{p.title || "Untitled"}</p>
                        <Badge variant="outline" className="text-[10px]">
                          Scheduled
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {p.platforms[0]?.caption || "—"}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {p.scheduledAt
                          ? new Date(p.scheduledAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "—"}
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Content ideas</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">AI suggestions for your brand</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))
            ) : recs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add a brand voice to personalize ideas.
              </p>
            ) : (
              recs.map((r, idx) => (
                <div key={`${r.topic}-${idx}`} className="rounded-xl border border-border/80 p-3.5">
                  <p className="text-sm font-medium leading-snug">{r.topic}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">{r.reason}</p>
                  <Button variant="link" size="sm" className="mt-1 h-auto px-0" asChild>
                    <Link
                      href={`/dashboard/content-studio/generate?topic=${encodeURIComponent(r.topic)}`}
                    >
                      Use this idea
                    </Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Recent activity</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Publishing, drafts, and workspace events
              </p>
            </div>
            <Button variant="ghost" size="sm" className="text-primary" asChild>
              <Link href="/dashboard/posts">
                All posts <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <RecentActivityFeed items={activity} loading={loading} />
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Plan usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <UsageRow
              icon={FileText}
              label="Posts"
              used={usage?.postsThisMonth.used ?? 0}
              limit={usage?.postsThisMonth.limit ?? null}
            />
            <UsageRow
              icon={Users}
              label="Accounts"
              used={usage?.accounts.used ?? 0}
              limit={usage?.accounts.limit ?? null}
            />
            <UsageRow
              icon={LayoutTemplate}
              label="Templates"
              used={usage?.templates.used ?? 0}
              limit={usage?.templates.limit ?? null}
            />
            <UsageRow
              icon={ImageIcon}
              label="Brand voice"
              used={usage?.brandVoice ? 1 : 0}
              limit={1}
            />
            <Button variant="outline" className="w-full" asChild>
              <Link href="/dashboard/billing">
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Manage plan
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
