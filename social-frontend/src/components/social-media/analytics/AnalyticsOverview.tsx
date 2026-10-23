"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { Activity, ArrowDownWideNarrow, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Check, ChevronDown, Download, Eye, FileText, Info, MessageCircle, MousePointerClick, RefreshCcw, Table2, Target, Users } from "lucide-react";
import { PageHeader } from "@/components/layouts/PageHeader";
import { PlatformIcon } from "@/components/platform-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { selectUser } from "@/features/auth/authSlice";
import { setAnalyticsDateRange } from "@/features/social-media/socialAnalyticsSlice";
import { fetchAnalyticsOverview, fetchPostPerformance } from "@/features/social-media/socialAnalyticsThunks";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { PLATFORM_LABELS, type AnalyticsOverview as OverviewData, type PostPerformanceItem } from "@/types/social-media.types";
import { ANALYTICS_PLATFORMS, analyticsCsv, analyticsRange, analyticsView, formatAnalyticsDate, type AnalyticsChannel, type AnalyticsPeriod } from "./analytics-view";

const AnalyticsCharts = dynamic(() => import("./AnalyticsCharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full" />,
});
const number = (value: number) => value.toLocaleString();
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const periods: Record<AnalyticsPeriod, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  ytd: "Year to date",
};

type Report = {
  overview: OverviewData;
  posts: PostPerformanceItem[];
  postsError: string | null;
  orgId: string;
  period: AnalyticsPeriod;
};

export default function AnalyticsOverview() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const [channel, setChannel] = useState<AnalyticsChannel>("all");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [showTable, setShowTable] = useState(false);
  const [postSort, setPostSort] = useState("engagementRate");
  const [showAllPosts, setShowAllPosts] = useState(false);
  const [exported, setExported] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    let active = true;
    const range = analyticsRange(period);
    dispatch(setAnalyticsDateRange(range));
    const overviewRequest = dispatch(fetchAnalyticsOverview({ orgId, ...range }));
    const postsRequest = dispatch(fetchPostPerformance({ orgId, ...range, sort: "engagementRate", order: "desc" }));
    setLoading(true);
    setError(null);
    setExported(false);
    void Promise.allSettled([overviewRequest.unwrap(), postsRequest.unwrap()]).then(([overviewResult, postsResult]) => {
      if (!active) return;
      if (overviewResult.status === "rejected") {
        setError(typeof overviewResult.reason === "string" ? overviewResult.reason : "We couldn’t load your analytics. Please try again.");
      } else {
        setReport({
          overview: overviewResult.value,
          posts: postsResult.status === "fulfilled" ? postsResult.value : [],
          postsError: postsResult.status === "rejected" ? "Post rankings couldn’t be loaded. Your summary metrics are still available." : null,
          orgId,
          period,
        });
      }
      setLoading(false);
    });
    return () => {
      active = false;
      overviewRequest.abort();
      postsRequest.abort();
    };
  }, [dispatch, orgId, period, revision]);

  const currentReport = report?.orgId === orgId && report.period === period ? report : null;
  const view = useMemo(() => currentReport ? analyticsView(currentReport.overview, currentReport.posts, channel) : null, [currentReport, channel]);
  const rankedPosts = useMemo(() => [...(view?.posts ?? [])].sort((a, b) => {
    if (postSort === "reach") return b.reach - a.reach;
    if (postSort === "engagements") return b.engagements - a.engagements;
    return b.engagementRate - a.engagementRate;
  }), [view?.posts, postSort]);
  const topPosts = showAllPosts ? rankedPosts : rankedPosts.slice(0, 5);
  const metrics = view?.metrics;
  const dateLabel = currentReport ? `${formatAnalyticsDate(currentReport.overview.fromDate)} – ${formatAnalyticsDate(currentReport.overview.toDate)}` : periods[period];
  const refresh = () => setRevision((value) => value + 1);
  const exportReport = () => {
    if (!currentReport) return;
    const blob = new Blob([analyticsCsv(currentReport.overview, channel, currentReport.posts)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `social-analytics-${channel}-${currentReport.overview.fromDate}-${currentReport.overview.toDate}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
  };

  return (
    <div className="space-y-6" aria-busy={loading}>
      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <PageHeader icon={BarChart3} title="Analytics" description="Understand what works. Build on your best content." />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={channel} onValueChange={(value) => { setChannel(value as AnalyticsChannel); setExported(false); setShowAllPosts(false); }}>
            <SelectTrigger className="w-44 bg-card" aria-label="Filter by channel"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              {ANALYTICS_PLATFORMS.map((platform) => <SelectItem key={platform} value={platform}><span className="inline-flex items-center gap-2"><PlatformIcon platform={platform} size="sm" />{PLATFORM_LABELS[platform]}</span></SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(value) => { setPeriod(value as AnalyticsPeriod); setShowAllPosts(false); }}>
            <SelectTrigger className="w-40 bg-card" aria-label="Date range"><CalendarDays className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(periods).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="icon" aria-label="Refresh analytics" onClick={refresh} disabled={loading || !orgId}><RefreshCcw className={cn("h-4 w-4", loading && "motion-safe:animate-spin")} /></Button>
          <Button variant="outline" onClick={exportReport} disabled={loading || !currentReport || Boolean(error)}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        </div>
      </header>

      <nav aria-label="Analytics reports" className="flex flex-wrap items-center gap-1 border-b border-border pb-3">
        <span aria-current="page" className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">Overview</span>
        {[["/dashboard/analytics/platform", "By platform"], ["/dashboard/analytics/posts", "Post performance"], ["/dashboard/analytics/audience", "Audience growth"]].map(([href, label]) => <Button key={href} variant="ghost" size="sm" asChild><Link href={href}>{label}</Link></Button>)}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" aria-live="polite">
        <span>{dateLabel} · {channel === "all" ? "All channels" : PLATFORM_LABELS[channel]} · UTC reporting dates</span>
        <span className="inline-flex items-center gap-1.5">{exported ? <><Check className="h-3.5 w-3.5 text-success" />Report downloaded</> : loading ? "Loading your report…" : "Based on available platform data"}</span>
      </div>

      {loading ? <AnalyticsSkeleton /> : error ? (
        <Card><CardContent className="py-12 text-center"><Info className="mx-auto mb-3 h-8 w-8 text-destructive" /><h2 className="font-semibold">Your report couldn’t be loaded</h2><p role="alert" className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{error}</p><Button onClick={refresh} className="mt-5"><RefreshCcw className="mr-2 h-4 w-4" />Try again</Button></CardContent></Card>
      ) : view && metrics ? (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: "Total reach", value: number(metrics.totalReach), icon: Users, help: "Reported reach across channels", detail: "Reach is not deduplicated across accounts or days." },
              { label: "Impressions", value: number(metrics.totalImpressions), icon: Eye, help: "Times your content was displayed", detail: "Includes repeat views from the same person." },
              { label: "Engagements", value: number(metrics.totalEngagements), icon: MessageCircle, help: "Interactions with your content", detail: "Engagement metrics may vary by platform." },
              { label: "Engagement rate", value: percent(metrics.avgEngagementRate), icon: Target, help: "Engagements ÷ impressions", detail: "This is a rate, not a change from a previous period." },
            ].map(({ label, value, icon: Icon, help, detail }) => (
              <Card key={label} className="min-w-0 shadow-soft">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xs text-muted-foreground sm:text-sm">{label}</h2>
                    <span className="hidden rounded-lg bg-muted p-2 text-primary sm:block">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</p>
                  <p className="mt-2 text-xs text-muted-foreground" title={detail}>{help}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3 rounded-xl border border-border bg-card px-5 py-3 text-sm">
            <span className="inline-flex items-center gap-2 text-muted-foreground"><FileText className="h-4 w-4" /><strong className="font-semibold text-foreground">{number(metrics.totalPosts)}</strong>published posts</span>
            {metrics.totalClicks !== null && <span className="inline-flex items-center gap-2 text-muted-foreground"><MousePointerClick className="h-4 w-4" /><strong className="font-semibold text-foreground">{number(metrics.totalClicks)}</strong>clicks</span>}
            {metrics.followerGrowth !== null && <span className="inline-flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /><strong className="font-semibold text-foreground">{metrics.followerGrowth > 0 ? "+" : ""}{number(metrics.followerGrowth)}</strong>net new followers</span>}
          </div>

          {!view.hasActivity ? (
            <Card className="shadow-soft"><CardContent className="py-16 text-center"><span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><BarChart3 className="h-6 w-6" /></span><h2 className="text-lg font-semibold">A clearer picture starts with your next post</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">No activity was reported {channel === "all" ? "across your channels" : `for ${PLATFORM_LABELS[channel]}`} in this period. Try a wider date range or publish new content.</p><div className="mt-5 flex flex-wrap justify-center gap-2"><Button asChild><Link href="/dashboard/content-studio/generate">Create a post<ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button variant="outline" asChild><Link href="/dashboard/accounts">Manage accounts</Link></Button></div></CardContent></Card>
          ) : (
            <>
              <div className="grid gap-5 xl:grid-cols-3">
                <Card className="min-w-0 shadow-soft xl:col-span-2">
                  <CardHeader className="flex flex-wrap flex-row items-start justify-between gap-3 space-y-0">
                    <div>
                      <CardTitle className="text-base"><h2>Engagement over time</h2></CardTitle>
                      <CardDescription className="mt-1">Daily interactions with your published content.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowTable((value) => !value)} aria-pressed={showTable}>
                      <Table2 className="mr-2 h-3.5 w-3.5" />
                      {showTable ? "Show chart" : "View data"}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {showTable ? (
                      <div className="h-72 overflow-auto rounded-lg border border-border">
                        <Table>
                          <caption className="sr-only">Daily engagements for {dateLabel}</caption>
                          <TableHeader>
                            <TableRow><TableHead>Date (UTC)</TableHead><TableHead className="text-right">Engagements</TableHead></TableRow>
                          </TableHeader>
                          <TableBody>
                            {view.daily.map((point) => (
                              <TableRow key={point.date}>
                                <TableCell>{point.date}</TableCell>
                                <TableCell className="text-right tabular-nums">{number(point.engagements)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : <AnalyticsCharts data={view.daily} />}
                    <p className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
                      <Activity className="h-4 w-4 shrink-0 text-primary" />
                      <span>
                        {view.peak ? <>Peak day: <strong className="font-medium text-foreground">{formatAnalyticsDate(view.peak.date)}</strong> with {number(view.peak.engagements)} engagements.</> : "No engagement reported in this period. Publish consistently to start identifying patterns."}
                      </span>
                    </p>
                  </CardContent>
                </Card>

                <Card className="min-w-0 shadow-soft">
                  <CardHeader>
                    <CardTitle className="text-base"><h2>Where your reach comes from</h2></CardTitle>
                    <CardDescription>Reported reach by channel, not audience demographics.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                  {view.reach.length ? view.reach.map((row) => {
                    const share = metrics.totalReach ? row.reach / metrics.totalReach : 0;
                    return <div key={row.platform}><div className="mb-2 flex items-center justify-between gap-2"><span className="inline-flex items-center gap-2 text-sm font-medium"><PlatformIcon platform={row.platform} size="sm" />{PLATFORM_LABELS[row.platform]}</span><span className="text-sm font-semibold tabular-nums">{number(row.reach)}</span></div><div className="flex items-center gap-3"><progress value={row.reach} max={Math.max(1, metrics.totalReach)} aria-label={`${PLATFORM_LABELS[row.platform]} share of reach`} className="h-2 flex-1 overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary" /><span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{percent(share)}</span></div></div>;
                  }) : <p className="py-10 text-center text-sm text-muted-foreground">No reach reported for this period.</p>}
                  <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">One person may be counted on multiple channels. These totals aren’t a unique audience count.</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="min-w-0 shadow-soft">
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle className="text-base"><h2>Channel performance</h2></CardTitle>
                    <CardDescription className="mt-1">Compare distribution and engagement side by side.</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/dashboard/analytics/platform">Explore platforms<ArrowUpRight className="ml-1 h-4 w-4" /></Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <caption className="sr-only">Channel performance for {dateLabel}</caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Channel</TableHead>
                        <TableHead className="text-right">Posts</TableHead>
                        <TableHead className="text-right">Reach</TableHead>
                        <TableHead className="text-right">Impressions</TableHead>
                        <TableHead className="text-right">Engagements</TableHead>
                        <TableHead className="text-right">Eng. rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {view.platformRows.map((row) => (
                        <TableRow key={row.platform}>
                          <TableCell>
                            <span className="inline-flex items-center gap-2 whitespace-nowrap font-medium">
                              <PlatformIcon platform={row.platform} size="sm" />{PLATFORM_LABELS[row.platform]}
                            </span>
                          </TableCell>
                          {[row.posts, row.reach, row.impressions, row.engagements].map((value, index) => (
                            <TableCell key={index} className="text-right tabular-nums">{number(value)}</TableCell>
                          ))}
                          <TableCell className="text-right font-medium tabular-nums">{percent(row.engagementRate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="min-w-0 shadow-soft">
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle className="text-base"><h2>Your strongest content</h2></CardTitle>
                    <CardDescription className="mt-1">Find the posts worth learning from and repurposing.</CardDescription>
                  </div>
                  <Select value={postSort} onValueChange={(value) => { setPostSort(value); setShowAllPosts(false); }}>
                    <SelectTrigger className="w-48" aria-label="Rank posts by">
                      <ArrowDownWideNarrow className="mr-2 h-4 w-4 shrink-0" /><SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="engagementRate">Engagement rate</SelectItem>
                      <SelectItem value="engagements">Engagements</SelectItem>
                      <SelectItem value="reach">Reach</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent>
                  {currentReport?.postsError ? (
                    <div role="alert" className="rounded-lg border border-border bg-muted/50 p-4 text-sm">
                      <p>{currentReport.postsError}</p>
                      <Button variant="outline" size="sm" onClick={refresh} className="mt-3">Retry post rankings</Button>
                    </div>
                  ) : topPosts.length ? (
                    <div className="divide-y divide-border">
                      {topPosts.map((post, index) => (
                        <Link
                          key={`${post.postId}-${post.platformRowId}`}
                          href={`/dashboard/posts/${post.postId}`}
                          prefetch={false}
                          className="group flex items-center gap-3 rounded-lg py-4 transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-4"
                        >
                          <span className="w-5 shrink-0 text-center text-xs font-medium text-muted-foreground tabular-nums">{index + 1}</span>
                          <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                            {post.imageUrl ? <Image src={post.imageUrl} alt="" fill sizes="56px" unoptimized className="object-cover" /> : <FileText className="h-5 w-5 text-muted-foreground" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-sm font-medium leading-relaxed group-hover:text-primary">{post.caption || "Untitled post"}</span>
                            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              <PlatformIcon platform={post.platform} size="sm" />{PLATFORM_LABELS[post.platform]}
                              {post.publishedAt ? ` · ${formatAnalyticsDate(post.publishedAt)}` : ""}
                            </span>
                          </span>
                          {postSort !== "reach" && (
                            <span className="hidden w-24 shrink-0 text-right sm:block">
                              <span className="block text-sm font-semibold tabular-nums">{number(post.reach)}</span>
                              <span className="text-xs text-muted-foreground">reach</span>
                            </span>
                          )}
                          <span className="w-20 shrink-0 text-right">
                            <span className="block text-sm font-semibold tabular-nums">
                              {postSort === "reach" ? number(post.reach) : postSort === "engagements" ? number(post.engagements) : percent(post.engagementRate)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {postSort === "reach" ? "reach" : postSort === "engagements" ? "engagements" : "eng. rate"}
                            </span>
                          </span>
                          <ArrowUpRight className="hidden h-4 w-4 shrink-0 text-muted-foreground md:block" />
                        </Link>
                      ))}
                    </div>
                  ) : <p className="py-10 text-center text-sm text-muted-foreground">No published posts to rank in this period.</p>}
                  {rankedPosts.length > 5 && (
                    <Button variant="outline" className="mt-3 w-full" onClick={() => setShowAllPosts((value) => !value)} aria-expanded={showAllPosts}>
                      {showAllPosts ? "Show fewer posts" : `View all ${rankedPosts.length} posts`}
                      <ChevronDown className={cn("ml-2 h-4 w-4", showAllPosts && "rotate-180")} />
                    </Button>
                  )}
                </CardContent>
              </Card>
            </>
          )}
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><Info className="h-4 w-4 shrink-0" />Metrics reflect data currently available from each platform. Zero may mean no activity or data not yet reported. Engagement rate is engagements divided by impressions, not a period-over-period trend.</p>
        </>
      ) : null}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div role="status" aria-label="Loading analytics" className="space-y-5">
      <span className="sr-only">Loading analytics</span>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-40 rounded-xl" />)}
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="grid gap-5 xl:grid-cols-3">
        <Skeleton className="h-96 rounded-xl xl:col-span-2" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}