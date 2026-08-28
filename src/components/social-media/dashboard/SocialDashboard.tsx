"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Image as ImageIcon,
  Link2,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  Wand2,
} from "lucide-react";

import socialMediaApi from "@/api/endpoints/social-media.api";
import { PlatformIcon } from "@/components/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { selectUser } from "@/features/auth/authSlice";
import { PLAN_DISPLAY_NAMES } from "@/lib/plans";
import {
  activityLabel,
  activityVisualType,
  relativeActivityTime,
  type ActivityVisualType,
} from "@/lib/activity";
import { useAppSelector } from "@/store/hooks";
import type {
  SocialActivityItem,
  SocialDashboardStats,
  SocialPlatform,
  SocialPost,
} from "@/types/social-media.types";

function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | number;
  delta: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-3 flex items-end justify-between">
          {loading ? (
            <Skeleton className="h-9 w-20" />
          ) : (
            <span className="text-3xl font-semibold tracking-tight">{value}</span>
          )}
          <span className="flex items-center gap-1 text-xs font-medium text-success">
            <TrendingUp className="h-3 w-3" />
            {delta}
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
        <span className="font-medium">
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

function relativeTime(iso: string | null): string {
  return relativeActivityTime(iso);
}

const ACTIVITY_ICONS: Record<
  ActivityVisualType,
  React.ComponentType<{ className?: string }>
> = {
  generated: Sparkles,
  published: Send,
  connected: Link2,
  scheduled: CalendarClock,
};

export default function SocialDashboard() {
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";
  const [stats, setStats] = useState<SocialDashboardStats | null>(null);
  const [activity, setActivity] = useState<SocialActivityItem[]>([]);
  const [recs, setRecs] = useState<Array<{ topic: string; reason: string }>>([]);
  const [upcoming, setUpcoming] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      socialMediaApi.getDashboardStats(orgId),
      socialMediaApi.getActivity(orgId, 10),
      socialMediaApi.getRecommendations(orgId),
      socialMediaApi.listPosts(orgId, { status: "scheduled", pageSize: 4 }),
    ])
      .then(([s, a, r, posts]) => {
        if (!active) return;
        setStats(s);
        setActivity(a);
        setRecs(r);
        setUpcoming(posts.items);
      })
      .catch(() => {
        if (active) setError("Failed to load dashboard. Check that the API is running.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orgId]);

  const usage = stats?.usage;
  const firstName = user?.name?.split(" ")[0] || "there";
  const postsLeft =
    usage?.postsThisMonth.limit != null
      ? Math.max(0, usage.postsThisMonth.limit - usage.postsThisMonth.used)
      : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Card className="overflow-hidden border-0 bg-primary text-primary-foreground shadow-elevated">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <p className="text-xs uppercase tracking-wider text-primary-foreground/70">
                {greeting()}, {firstName}
              </p>
              <h1 className="mt-1 text-2xl font-semibold md:text-3xl">
                Your social is on track this week.
              </h1>
              <p className="mt-2 text-sm text-primary-foreground/80">
                {planLabel(usage?.plan ?? user?.plan)} plan
                {postsLeft != null ? ` · ${postsLeft} posts remaining this month` : null}
                {stats ? ` · ${stats.connectedAccounts} accounts connected` : null}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" asChild>
                <Link href="/dashboard/content-studio/generate">
                  <Wand2 className="mr-1.5 h-4 w-4" /> Generate content
                </Link>
              </Button>
              <Button
                variant="outline"
                className="border-white/30 bg-white/10 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground"
                asChild
              >
                <Link href="/dashboard/calendar">
                  <CalendarClock className="mr-1.5 h-4 w-4" /> Schedule post
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!loading && (stats?.connectedAccounts ?? 0) === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Connect your first social account</p>
              <p className="text-xs text-muted-foreground">
                Link Facebook, Instagram, LinkedIn, or X to start publishing.
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/accounts">
                <Link2 className="mr-1.5 h-4 w-4" /> Connect accounts
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Posts this week"
          value={stats?.postsThisWeek ?? 0}
          delta="this week"
          icon={Send}
          loading={loading}
        />
        <KpiCard
          label="Scheduled posts"
          value={upcoming.length}
          delta="upcoming"
          icon={CalendarClock}
          loading={loading}
        />
        <KpiCard
          label="Total reach"
          value={(stats?.totalReach ?? 0).toLocaleString()}
          delta={`${((stats?.avgEngagementRate ?? 0) * 100).toFixed(1)}% eng.`}
          icon={BarChart3}
          loading={loading}
        />
        <KpiCard
          label="Connected accounts"
          value={stats?.connectedAccounts ?? 0}
          delta={stats?.expiredAccounts ? `${stats.expiredAccounts} need attention` : "healthy"}
          icon={Users}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base">Upcoming posts</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Your next scheduled posts</p>
            </div>
            <Button variant="ghost" size="sm" className="text-primary" asChild>
              <Link href="/dashboard/posts/scheduled">
                View all <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
            ) : upcoming.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">No scheduled posts yet.</p>
                <Button className="mt-3" size="sm" asChild>
                  <Link href="/dashboard/content-studio/generate">Create one</Link>
                </Button>
              </div>
            ) : (
              upcoming.map((p) => {
                const platform = (p.platforms[0]?.platform ?? "linkedin") as SocialPlatform;
                return (
                  <Link
                    key={p.id}
                    href={`/dashboard/posts/${p.id}`}
                    className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
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
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">AI recommendations</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
            ) : recs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Publish a few posts to unlock personalized recommendations.
              </p>
            ) : (
              recs.map((r, idx) => (
                <div key={`${r.topic}-${idx}`} className="rounded-xl border border-border p-3.5">
                  <Badge variant="secondary" className="text-[10px]">
                    Idea
                  </Badge>
                  <p className="mt-2 text-sm font-medium">{r.topic}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-5">
                {activity.map((a) => {
                  const visualType = activityVisualType(a);
                  const Icon = ACTIVITY_ICONS[visualType];
                  const label = activityLabel(a);
                  const content = (
                    <>
                      <p className="text-sm leading-snug">{label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {relativeTime(a.createdAt)}
                      </p>
                    </>
                  );

                  return (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[26px] flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground ring-4 ring-background">
                        <Icon className="h-3 w-3" />
                      </span>
                      {a.entityType === "post" && a.entityId ? (
                        <Link
                          href={`/dashboard/posts/${a.entityId}`}
                          className="block rounded-lg pr-2 transition-colors hover:text-primary"
                        >
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Usage this month</CardTitle>
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
              label="Connected accounts"
              used={usage?.accounts.used ?? 0}
              limit={usage?.accounts.limit ?? null}
            />
            <UsageRow
              icon={Sparkles}
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
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> View plan
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
