import type { AnalyticsOverview, PostPerformanceItem, SocialPlatform } from "@/types/social-media.types";

export const ANALYTICS_PLATFORMS: SocialPlatform[] = ["facebook", "instagram", "linkedin", "x"];
export type AnalyticsChannel = SocialPlatform | "all";
export type AnalyticsPeriod = "7d" | "30d" | "90d" | "ytd";

export function analyticsRange(period: AnalyticsPeriod, now = new Date()) {
  const end = new Date(now);
  const start = new Date(now);
  if (period === "ytd") start.setUTCMonth(0, 1);
  else start.setUTCDate(end.getUTCDate() - (period === "7d" ? 6 : period === "90d" ? 89 : 29));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

export function analyticsView(overview: AnalyticsOverview, posts: PostPerformanceItem[], channel: AnalyticsChannel) {
  const daily = overview.engagementSeries.map((row) => ({
    date: String(row.date),
    engagements: (channel === "all" ? ANALYTICS_PLATFORMS : [channel]).reduce(
      (sum, platform) => sum + Number(row[platform] || 0), 0,
    ),
  }));
  const platformRows = overview.platformComparison
    .filter((row) => channel === "all" || row.platform === channel)
    .map((row) => ({
      ...row,
      engagements: overview.engagementSeries.reduce((sum, point) => sum + Number(point[row.platform] || 0), 0),
    }));
  const selected = platformRows[0];
  const metrics = channel === "all" ? overview.metrics : {
    totalPosts: selected?.posts ?? 0,
    totalReach: selected?.reach ?? 0,
    totalImpressions: selected?.impressions ?? 0,
    totalEngagements: daily.reduce((sum, point) => sum + point.engagements, 0),
    avgEngagementRate: selected?.engagementRate ?? 0,
    totalClicks: null,
    followerGrowth: null,
  };
  const filteredPosts = posts.filter((post) => channel === "all" || post.platform === channel);
  const reach = platformRows.filter((row) => row.reach > 0).sort((a, b) => b.reach - a.reach);
  const peak = daily.reduce<(typeof daily)[number] | null>((best, point) =>
    point.engagements > (best?.engagements ?? 0) ? point : best, null);
  const hasActivity = metrics.totalPosts > 0 || metrics.totalReach > 0 || metrics.totalImpressions > 0 ||
    metrics.totalEngagements > 0 || Boolean(metrics.totalClicks) || Boolean(metrics.followerGrowth) || filteredPosts.length > 0;
  return { daily, platformRows, metrics, posts: filteredPosts, reach, peak, hasActivity };
}

export function analyticsCsv(overview: AnalyticsOverview, channel: AnalyticsChannel, posts: PostPerformanceItem[]) {
  const view = analyticsView(overview, posts, channel);
  const escape = (value: string | number | null) => {
    const text = String(value ?? "");
    const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const rows: Array<Array<string | number | null>> = [
    ["Analytics report", overview.fromDate, overview.toDate, channel],
    ["Metric", "Value"],
    ...Object.entries(view.metrics).map(([key, value]) => [key, value]),
    [],
    ["Date", "Engagements"],
    ...view.daily.map((point) => [point.date, point.engagements]),
    [],
    ["Platform", "Posts", "Reach", "Impressions", "Engagements", "Engagement rate"],
    ...view.platformRows.map((row) => [row.platform, row.posts, row.reach, row.impressions, row.engagements, row.engagementRate]),
    [],
    ["Post", "Platform", "Published", "Caption", "Reach", "Impressions", "Engagements", "Engagement rate"],
    ...view.posts.map((post) => [post.postId, post.platform, post.publishedAt, post.caption, post.reach, post.impressions, post.engagements, post.engagementRate]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n");
}

export function formatAnalyticsDate(date: string) {
  return new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}