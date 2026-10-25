"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, ArrowRight, ArrowUpRight, BarChart3, CalendarClock, CalendarDays, CheckCircle2, ChevronRight, Clock, FileText, Image as ImageIcon, LayoutTemplate, Lightbulb, Link2, RefreshCcw, Target, Users } from "lucide-react";
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
        <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
          <Button className="order-last col-span-2 justify-self-end sm:order-none" variant="outline" size="icon" aria-label="Refresh dashboard" disabled={loading || refreshing || !user?.workspaceId} onClick={() => void reload()}>
            <RefreshCcw className={cn("h-4 w-4", refreshing && "motion-safe:animate-spin")} />
          </Button>
          <Button variant="outline" asChild><Link href="/dashboard/calendar"><CalendarDays className="mr-2 h-4 w-4" />View calendar</Link></Button>
          <Button asChild><Link href="/dashboard/content-studio/generate"><ProductGenerateIcon className="mr-2 h-4 w-4" />Create a post</Link></Button>
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

          <section aria-label="Workspace metrics" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: "Posts created", value: stats.postsThisWeek.toLocaleString(), detail: "Last 7 days · all statuses", icon: FileText, href: "/dashboard/posts" },
              { label: "Total reach", value: stats.totalReach.toLocaleString(), detail: "Last 30 days · reported reach", icon: BarChart3, href: "/dashboard/analytics" },
              { label: "Engagement rate", value: `${(stats.avgEngagementRate * 100).toFixed(1)}%`, detail: "Last 30 days · per impression", icon: Target, href: "/dashboard/analytics" },
              { label: "Connected accounts", value: stats.connectedAccounts.toLocaleString(), detail: attentionCount ? `${attentionCount} need attention` : stats.connectedAccounts ? "Ready for your next post" : "Connect your first channel", icon: Users, href: "/dashboard/accounts" },
            ].map(({ label, value, detail, icon: Icon, href }) => (
              <Link key={label} href={href} className="group min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Card className="h-full shadow-soft transition-colors group-hover:border-primary/40">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-2"><h2 className="text-xs text-muted-foreground sm:text-sm">{label}</h2><span className="hidden rounded-lg bg-muted p-2 text-primary sm:block"><Icon className="h-4 w-4" /></span></div>
                    <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{detail}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </section>

          <nav aria-label="Quick actions" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Plan content", hint: "Build your next campaign", href: "/dashboard/content-studio?tab=planner", icon: CalendarClock },
              { label: "Continue a draft", hint: "Pick up where you left off", href: "/dashboard/posts/drafts", icon: FileText },
              { label: "Media library", hint: "Your images and videos", href: "/dashboard/content-studio/media", icon: ImageIcon },
              { label: "View analytics", hint: "See what’s working", href: "/dashboard/analytics", icon: BarChart3 },
            ].map(({ label, hint, href, icon: Icon }) => (
              <Link key={label} href={href} className="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-3 transition hover:border-primary/30 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0"><span className="block text-xs font-medium sm:text-sm">{label}</span><span className="mt-0.5 hidden text-xs text-muted-foreground lg:block">{hint}</span></span>
                <ChevronRight className="ml-auto hidden h-4 w-4 shrink-0 text-muted-foreground xl:block" />
              </Link>
            ))}
          </nav>

          <div className="grid items-start gap-5 xl:grid-cols-3">
            <div className="min-w-0 space-y-5 xl:col-span-2">
              <Card className="min-w-0 shadow-soft">
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                  <div><CardTitle className="text-base"><h2>Next in your queue</h2></CardTitle><CardDescription className="mt-1">A preview of your scheduled posts, ordered by time.</CardDescription></div>
                  <Button variant="ghost" size="sm" asChild><Link href="/dashboard/posts/scheduled">All scheduled posts<ArrowUpRight className="ml-1 h-4 w-4" /></Link></Button>
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

              <Card className="min-w-0 shadow-soft">
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div><CardTitle className="text-base"><h2>Your connected channels</h2></CardTitle><CardDescription className="mt-1">A quick health check before your next post goes live.</CardDescription></div>
                  <Button variant="ghost" size="sm" asChild><Link href="/dashboard/accounts">Manage<ArrowUpRight className="ml-1 h-4 w-4" /></Link></Button>
                </CardHeader>
                <CardContent>
                  {accounts.length ? (
                    <ul className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                      {accounts.map((account) => {
                        const status = connectionState(account.tokenStatus);
                        return <li key={account.id} className="min-w-0"><Link href="/dashboard/accounts" className="flex h-full min-w-0 items-start gap-3 rounded-lg border border-border p-3 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><PlatformIcon platform={account.platform} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{account.accountName || PLATFORM_LABELS[account.platform]}</span><span className="mt-1 block text-xs text-muted-foreground">{PLATFORM_LABELS[account.platform]} · {(account.followerCount ?? 0).toLocaleString()} followers</span><span className={cn("mt-2 inline-flex items-center gap-1 text-xs font-medium", status.healthy ? "text-success" : "text-destructive")}>{status.healthy ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}{status.label}</span></span></Link></li>;
                      })}
                    </ul>
                  ) : <p className="py-4 text-sm text-muted-foreground">Your connected accounts and their status will appear here.</p>}
                </CardContent>
              </Card>

              <Card className="min-w-0 shadow-soft">
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0"><div><CardTitle className="text-base"><h2>Recent activity</h2></CardTitle><CardDescription className="mt-1">The latest publishing and workspace updates.</CardDescription></div><Button variant="ghost" size="sm" asChild><Link href="/dashboard/posts">All posts<ArrowUpRight className="ml-1 h-4 w-4" /></Link></Button></CardHeader>
                <CardContent><RecentActivityFeed items={data.activity} /></CardContent>
              </Card>
            </div>

            <aside aria-label="Workspace priorities and resources" className="min-w-0 space-y-5">
              <Card className={cn("shadow-soft", (attentionCount > 0 || postLimitReached) && "border-destructive/30")}>
                <CardHeader><CardTitle className="flex items-center justify-between gap-2 text-base"><h2>Needs attention</h2>{attentionCount === 0 && !postLimitReached && <CheckCircle2 className="h-4 w-4 text-success" />}</CardTitle><CardDescription>Keep your publishing workflow on track.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {attentionCount > 0 && <PriorityLink href="/dashboard/accounts" title={`${attentionCount} account${attentionCount === 1 ? "" : "s"} need${attentionCount === 1 ? "s" : ""} attention`} detail="Review the connection before scheduling more content." />}
                  {postLimitReached && <PriorityLink href="/dashboard/billing" title="Monthly post allowance reached" detail="Review your plan to keep creating content this month." />}
                  {!attentionCount && !postLimitReached && <p className="text-sm leading-relaxed text-muted-foreground">{stats.connectedAccounts ? "No connection or post allowance issues reported. You’re ready to create." : "Connect your first account when you’re ready to publish."}</p>}
                  <p className="border-t border-border pt-3 text-xs text-muted-foreground">Based on connection status and your current post allowance.</p>
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Lightbulb className="h-4 w-4 text-primary" /><h2>A little inspiration</h2></CardTitle><CardDescription>Starting points for your next post.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {data.recommendations.length ? data.recommendations.map((idea, index) => (
                    <Link key={`${idea.topic}-${index}`} href={`/dashboard/content-studio/generate?topic=${encodeURIComponent(idea.topic)}`} prefetch={false} className="group block rounded-lg border border-border p-3 transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <h3 className="text-sm font-medium leading-relaxed">{idea.topic}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{idea.reason}</p><span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">Use this idea<ArrowRight className="h-3 w-3" /></span>
                    </Link>
                  )) : <div className="text-sm text-muted-foreground"><p>Tell us about your business to give your content a clearer direction.</p><Button variant="link" className="mt-1 h-auto px-0" asChild><Link href="/dashboard/content-studio/brand-voice">Set up brand profile<ArrowRight className="ml-1 h-3 w-3" /></Link></Button></div>}
                </CardContent>
              </Card>

              {usage && <Card className="shadow-soft"><CardHeader className="flex flex-row items-center justify-between space-y-0"><CardTitle className="text-base"><h2>Workspace usage</h2></CardTitle><Badge variant="secondary">{PLAN_DISPLAY_NAMES[String(plan).toLowerCase()] ?? plan}</Badge></CardHeader><CardContent className="space-y-4"><UsageRow label="Posts this month" icon={FileText} {...usage.postsThisMonth} /><UsageRow label="Connected accounts" icon={Users} {...usage.accounts} /><UsageRow label="Saved templates" icon={LayoutTemplate} {...usage.templates} /><div className="flex items-center justify-between border-t border-border pt-3 text-xs"><span className="text-muted-foreground">Brand voice feature</span><span className="font-medium">{usage.brandVoice ? "Included" : "Not included"}</span></div><Button variant="outline" className="w-full" asChild><Link href="/dashboard/billing">Manage plan<ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button></CardContent></Card>}
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
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
  return <div role="status" aria-label="Loading dashboard" className="space-y-5"><span className="sr-only">Loading dashboard</span><div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-40 rounded-xl" />)}</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-16 rounded-xl" />)}</div><div className="grid gap-5 xl:grid-cols-3"><div className="space-y-5 xl:col-span-2"><Skeleton className="h-96 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div><div className="space-y-5"><Skeleton className="h-48 rounded-xl" /><Skeleton className="h-96 rounded-xl" /></div></div></div>;
}