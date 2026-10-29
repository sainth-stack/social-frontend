"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, ArrowRight, ArrowUpRight, CalendarClock, CalendarDays, CheckCircle2, ChevronRight, Clock, FileText, LayoutTemplate, Link2, RefreshCcw, Users } from "lucide-react";
import { ProductDashboardIcon, ProductGenerateIcon } from "@/components/icons/product-icons";
import { PageHeader } from "@/components/layouts/PageHeader";
import { PlatformIcon } from "@/components/platform-icon";
import { RecentActivityFeed } from "@/components/social-media/dashboard/RecentActivityFeed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { selectUser } from "@/features/auth/authSlice";
import { useDashboardHome } from "@/hooks/useDashboardHome";
import { PLAN_DISPLAY_NAMES } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { PLATFORM_LABELS, type SocialPost } from "@/types/social-media.types";

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function connectionState(status: string) {
  if (status === "active") return { label: "Connected", healthy: true };
  if (status === "expired") return { label: "Reconnect needed", healthy: false };
  if (status === "expires_soon") return { label: "Expires soon", healthy: false };
  return { label: "Check connection", healthy: false };
}

export default function SocialDashboard() {
  const user = useAppSelector(selectUser);
  const { data, loading, refreshing, error, reload } = useDashboardHome(user?.workspaceId);
  const stats = data?.stats;
  const usage = stats?.usage;
  const firstName = user?.name?.trim().split(/\s+/)[0] || "there";
  const upcoming = useMemo(() => [...(data?.scheduledPosts ?? [])].sort((a, b) =>
    new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime(),
  ), [data?.scheduledPosts]);
  const accounts = stats?.accounts ?? [];
  const attentionAccounts = accounts.filter((account) => !connectionState(account.tokenStatus).healthy);
  const attentionCount = Math.max(attentionAccounts.length, stats?.expiredAccounts ?? 0);
  const postLimit = usage?.postsThisMonth.limit;
  const postLimitReached = postLimit != null && usage != null && usage.postsThisMonth.used >= postLimit;
  const date = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const plan = usage?.plan ?? user?.plan ?? "starter";

  return (
    <div className="mx-auto max-w-7xl space-y-6" aria-busy={loading}>
      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <PageHeader icon={ProductDashboardIcon} title={`${greeting()}, ${firstName}`} description="Your publishing day, at a glance. Let’s keep things moving." />
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild><Link href="/dashboard/content-studio/generate"><ProductGenerateIcon className="mr-2 h-4 w-4" />Create a post</Link></Button>
          <Button variant="outline" asChild><Link href="/dashboard/content-studio/planner"><CalendarClock className="mr-2 h-4 w-4" />Plan content</Link></Button>
          <Button variant="ghost" size="sm" asChild><Link href="/dashboard/calendar"><CalendarDays className="mr-2 h-4 w-4" />Calendar</Link></Button>
          <Button variant="ghost" size="icon" aria-label="Refresh dashboard" disabled={loading || refreshing || !user?.workspaceId} onClick={() => void reload()}>
            <RefreshCcw className={cn("h-4 w-4", refreshing && "motion-safe:animate-spin")} />
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{date} · {user?.workspaceName || "Your workspace"}</span>
        <span aria-live="polite">{refreshing ? "Refreshing your workspace…" : "Your workspace overview"}</span>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <div role="alert" className="flex items-start gap-2 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span>{error}{data ? " Showing your previously loaded overview." : ""}</span>
            </div>
            <Button variant="outline" size="sm" disabled={refreshing} onClick={() => void reload()}>Try again</Button>
          </CardContent>
        </Card>
      )}

      {loading || (!data && !error) ? <DashboardSkeleton /> : data && stats ? (
        <>
          {stats.connectedAccounts === 0 && (
            <section aria-labelledby="dashboard-setup" className="rounded-xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Link2 className="h-5 w-5" /></span>
                  <div><h2 id="dashboard-setup" className="font-semibold">Bring your channels together</h2><p className="mt-1 max-w-xl text-sm text-muted-foreground">Connect your first account to schedule content and track results. You can start creating drafts right away.</p></div>
                </div>
                <Button asChild><Link href="/dashboard/accounts">Connect an account<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              </div>
            </section>
          )}

          {(attentionCount > 0 || postLimitReached) && (
            <section aria-labelledby="dashboard-attention" className="rounded-xl border border-destructive/30 bg-card p-4">
              <h2 id="dashboard-attention" className="text-sm font-semibold">Needs attention</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {attentionCount > 0 && <PriorityLink href="/dashboard/accounts" title={`${attentionCount} account${attentionCount === 1 ? "" : "s"} need${attentionCount === 1 ? "s" : ""} attention`} detail="Review the connection before scheduling more content." />}
                {postLimitReached && <PriorityLink href="/dashboard/billing" title="Monthly post allowance reached" detail="Review your plan to keep creating content this month." />}
              </div>
            </section>
          )}

          <div className="min-w-0 space-y-5">
              <Card className="min-w-0 shadow-soft">
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                  <div><CardTitle className="text-base"><h2>Next in your queue</h2></CardTitle><CardDescription className="mt-1">A preview of your scheduled posts, ordered by time.</CardDescription></div>
                  <div className="flex flex-wrap gap-2"><Button variant="ghost" size="sm" asChild><Link href="/dashboard/posts/drafts">Continue a draft</Link></Button><Button variant="ghost" size="sm" asChild><Link href="/dashboard/posts/scheduled">All scheduled posts<ArrowUpRight className="ml-1 h-4 w-4" /></Link></Button></div>
                </CardHeader>
                <CardContent>
                  {upcoming.length ? <ul className="divide-y divide-border">{upcoming.map((post) => <UpcomingPost key={post.id} post={post} />)}</ul> : (
                    <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
                      <CalendarClock className="mx-auto mb-3 h-7 w-7 text-muted-foreground" />
                      <h3 className="text-sm font-medium">Make room for your next great post</h3>
                      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Your queue is clear. Create something new or schedule a saved draft.</p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2"><Button size="sm" asChild><Link href="/dashboard/content-studio/generate">Create a post</Link></Button><Button size="sm" variant="outline" asChild><Link href="/dashboard/posts/drafts">Browse drafts</Link></Button></div>
                    </div>
                  )}
                  {upcoming.length > 0 && <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />Times shown in your local timezone. Queue preview is not the total scheduled count.</p>}
                </CardContent>
              </Card>

              <section aria-label="Workspace metrics" className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-2 lg:grid-cols-4">
                {[
                  { label: "Posts created", value: stats.postsThisWeek.toLocaleString(), detail: "Last 7 days · all statuses", href: "/dashboard/posts" },
                  { label: "Total reach", value: stats.totalReach.toLocaleString(), detail: "Last 30 days · reported reach", href: "/dashboard/analytics" },
                  { label: "Engagement rate", value: `${(stats.avgEngagementRate * 100).toFixed(1)}%`, detail: "Last 30 days · per impression", href: "/dashboard/analytics" },
                  { label: "Connected accounts", value: stats.connectedAccounts.toLocaleString(), detail: attentionCount ? `${attentionCount} need attention` : stats.connectedAccounts ? "Ready for your next post" : "Connect your first channel", href: "/dashboard/accounts" },
                ].map(({ label, value, detail, href }) => (
                  <Link key={label} href={href} className="min-w-0 rounded-lg p-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <h2 className="text-xs text-muted-foreground">{label}</h2>
                    <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
                  </Link>
                ))}
              </section>

              <Card className="min-w-0">
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <CardTitle className="text-sm"><h2>Your connected channels</h2></CardTitle>
                  <Button variant="ghost" size="sm" asChild><Link href="/dashboard/accounts">Manage<ArrowUpRight className="ml-1 h-4 w-4" /></Link></Button>
                </CardHeader>
                <CardContent>
                  {accounts.length ? (
                    <ul className="flex min-w-0 flex-wrap gap-2">
                      {accounts.map((account) => {
                        const status = connectionState(account.tokenStatus);
                        return <li key={account.id} className="min-w-0 max-w-full"><Link href="/dashboard/accounts" className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/30 p-2 transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><PlatformIcon platform={account.platform} size="sm" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{account.accountName || PLATFORM_LABELS[account.platform]}</span><span className={cn("inline-flex items-center gap-1 text-xs", status.healthy ? "text-muted-foreground" : "text-destructive")}>{status.healthy ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}{status.label}</span></span></Link></li>;
                      })}
                    </ul>
                  ) : <p className="py-4 text-sm text-muted-foreground">Your connected accounts and their status will appear here.</p>}
                </CardContent>
              </Card>

              <div className="grid items-start gap-3 lg:grid-cols-2">
                <DashboardDetails title="Recent activity">
                  <Button variant="link" className="px-0" asChild><Link href="/dashboard/posts">All posts<ArrowUpRight className="ml-1 h-4 w-4" /></Link></Button>
                  <RecentActivityFeed items={data.activity} />
                </DashboardDetails>

                <DashboardDetails title="A little inspiration">
                  <p className="text-sm text-muted-foreground">Starting points for your next post.</p>
                  {data.recommendations.length ? data.recommendations.map((idea, index) => (
                    <Link key={`${idea.topic}-${index}`} href={`/dashboard/content-studio/generate?topic=${encodeURIComponent(idea.topic)}`} prefetch={false} className="group block rounded-lg border border-border p-3 transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <h3 className="text-sm font-medium leading-relaxed">{idea.topic}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{idea.reason}</p><span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">Use this idea<ArrowRight className="h-3 w-3" /></span>
                    </Link>
                  )) : <div className="text-sm text-muted-foreground"><p>Tell us about your business to give your content a clearer direction.</p><Button variant="link" className="mt-1 h-auto px-0" asChild><Link href="/dashboard/content-studio/brand-voice">Set up brand profile<ArrowRight className="ml-1 h-3 w-3" /></Link></Button></div>}
                  <Button variant="link" className="px-0" asChild><Link href="/dashboard/content-studio/media">Media library<ArrowUpRight className="ml-1 h-4 w-4" /></Link></Button>
                </DashboardDetails>
              </div>

              {usage && <DashboardDetails title="Workspace usage"><Badge variant="secondary">{PLAN_DISPLAY_NAMES[String(plan).toLowerCase()] ?? plan}</Badge><div className="grid gap-4 sm:grid-cols-3"><UsageRow label="Posts this month" icon={FileText} {...usage.postsThisMonth} /><UsageRow label="Connected accounts" icon={Users} {...usage.accounts} /><UsageRow label="Saved templates" icon={LayoutTemplate} {...usage.templates} /></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs"><div className="flex items-center gap-2"><span className="text-muted-foreground">Brand voice feature</span><span className="font-medium">{usage.brandVoice ? "Included" : "Not included"}</span></div><Button variant="link" size="sm" asChild><Link href="/dashboard/billing">Manage plan<ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button></div></DashboardDetails>}
          </div>
        </>
      ) : null}
    </div>
  );
}

function DashboardDetails({ title, children }: { title: string; children: React.ReactNode }) {
  return <details className="group min-w-0 rounded-xl border border-border bg-card"><summary className="cursor-pointer list-none rounded-xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"><h2 className="flex items-center justify-between gap-2 text-sm font-medium">{title}<ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground group-open:rotate-90" /></h2></summary><div className="space-y-3 px-4 pb-4">{children}</div></details>;
}

function PriorityLink({ href, title, detail }: { href: string; title: string; detail: string }) {
  return <Link href={href} className="flex items-start gap-2 rounded-lg bg-destructive/5 p-3 transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><span><span className="block text-sm font-medium">{title}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{detail}</span></span><ChevronRight className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /></Link>;
}

function UpcomingPost({ post }: { post: SocialPost }) {
  const scheduled = post.scheduledAt ? new Date(post.scheduledAt) : null;
  const validDate = scheduled && !Number.isNaN(scheduled.getTime()) ? scheduled : null;
  const platforms = [...new Set(post.platforms.map((platform) => platform.platform))];
  return (
    <li>
      <Link href={`/dashboard/posts/${post.id}`} prefetch={false} className="group flex items-start gap-3 rounded-lg py-4 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-4">
        <span className="hidden w-12 shrink-0 rounded-lg border border-border bg-muted/40 px-1 py-2 text-center sm:block"><span className="block text-xs text-muted-foreground">{validDate?.toLocaleDateString(undefined, { month: "short" }) ?? "Date"}</span><span className="mt-0.5 block text-lg font-semibold tabular-nums">{validDate?.getDate() ?? "—"}</span></span>
        <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted sm:h-16 sm:w-16">{post.imageUrl ? <Image src={post.imageUrl} alt="" fill sizes="64px" unoptimized className="object-cover" /> : <FileText className="h-5 w-5 text-muted-foreground" />}</span>
        <span className="min-w-0 flex-1"><span className="line-clamp-1 text-sm font-medium group-hover:text-primary">{post.title || "Untitled post"}</span><span className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{post.platforms[0]?.caption || "Open this post to review the content."}</span><span className="mt-2 flex flex-wrap items-center gap-2">{platforms.map((platform) => <span key={platform} title={PLATFORM_LABELS[platform]}><span className="sr-only">{PLATFORM_LABELS[platform]}</span><PlatformIcon platform={platform} size="sm" /></span>)}<time dateTime={validDate?.toISOString()} className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{validDate ? validDate.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Time not set"}</time></span></span>
        <Badge variant="secondary" className="hidden shrink-0 text-xs sm:inline-flex">Scheduled</Badge>
      </Link>
    </li>
  );
}

function UsageRow({ label, icon: Icon, used, limit }: { label: string; icon: React.ComponentType<{ className?: string }>; used: number; limit: number | null }) {
  const reached = limit != null && used >= limit;
  return (
    <div><div className="mb-2 flex items-center justify-between gap-2 text-xs"><span className="inline-flex items-center gap-1.5 text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</span><span className={cn("font-medium tabular-nums", reached && "text-destructive")}>{used.toLocaleString()} / {limit == null ? "Unlimited" : limit.toLocaleString()}</span></div>{limit == null ? <p className="text-xs text-muted-foreground">No plan limit</p> : <progress aria-label={label} value={limit === 0 ? 1 : Math.min(used, limit)} max={Math.max(1, limit)} className={cn("block h-1.5 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full", reached ? "[&::-webkit-progress-value]:bg-destructive [&::-moz-progress-bar]:bg-destructive" : "[&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary")} />}</div>
  );
}

function DashboardSkeleton() {
  return <div role="status" aria-label="Loading dashboard" className="space-y-5"><span className="sr-only">Loading dashboard</span><Skeleton className="h-96 rounded-xl" /><div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}</div><Skeleton className="h-24 rounded-xl" /><div className="grid gap-3 lg:grid-cols-2"><Skeleton className="h-14 rounded-xl" /><Skeleton className="h-14 rounded-xl" /></div><Skeleton className="h-14 rounded-xl" /></div>;
}