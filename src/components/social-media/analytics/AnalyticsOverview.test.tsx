import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { axe } from "vitest-axe";
import socialMediaApi from "@/api/endpoints/social-media.api";
import analyticsReducer from "@/features/social-media/socialAnalyticsSlice";
import type { AnalyticsOverview as OverviewData, PostPerformanceItem } from "@/types/social-media.types";
import AnalyticsOverview from "./AnalyticsOverview";
import { analyticsCsv, analyticsRange, analyticsView } from "./analytics-view";

vi.mock("@/api/endpoints/social-media.api", () => ({ default: { getAnalyticsOverview: vi.fn(), getPostPerformance: vi.fn() } }));
vi.mock("next/dynamic", () => ({ default: () => () => <div role="img" aria-label="Engagement chart" /> }));

const overview: OverviewData = {
  fromDate: "2026-10-01", toDate: "2026-10-02",
  metrics: { totalPosts: 3, totalReach: 900, totalImpressions: 1500, totalEngagements: 75, avgEngagementRate: 0.05, followerGrowth: 4, totalClicks: 16 },
  engagementSeries: [
    { date: "2026-10-01", facebook: 10, instagram: 15, linkedin: 0, x: 0 },
    { date: "2026-10-02", facebook: 20, instagram: 30, linkedin: 0, x: 0 },
  ],
  reachByPlatform: [{ platform: "facebook", reach: 300 }, { platform: "instagram", reach: 600 }],
  platformComparison: [
    { platform: "facebook", posts: 1, reach: 300, impressions: 600, engagementRate: 0.05, topPost: null },
    { platform: "instagram", posts: 2, reach: 600, impressions: 900, engagementRate: 0.05, topPost: null },
  ],
};
const posts: PostPerformanceItem[] = [
  { postId: "p1", platformRowId: "r1", caption: "Customer story", platform: "facebook", publishedAt: "2026-10-01T10:00:00Z", reach: 300, impressions: 600, likes: 20, comments: 5, shares: 5, clicks: 6, engagements: 30, engagementRate: 0.05, imageUrl: null },
  { postId: "p2", platformRowId: "r2", caption: "Launch, with \"benefits\"\nand details", platform: "instagram", publishedAt: "2026-10-02T10:00:00Z", reach: 600, impressions: 900, likes: 30, comments: 10, shares: 5, clicks: 10, engagements: 45, engagementRate: 0.05, imageUrl: null },
];

function renderScreen(workspaceId = "workspace-1") {
  const store = configureStore({
    reducer: { auth: () => ({ user: { workspaceId } }), socialAnalytics: analyticsReducer },
  });
  return render(<Provider store={store}><AnalyticsOverview /></Provider>);
}

beforeEach(() => {
  vi.mocked(socialMediaApi.getAnalyticsOverview).mockResolvedValue(overview);
  vi.mocked(socialMediaApi.getPostPerformance).mockResolvedValue({ fromDate: overview.fromDate, toDate: overview.toDate, items: posts });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

describe("analytics data", () => {
  it("uses inclusive UTC date ranges across month and year boundaries", () => {
    expect(analyticsRange("7d", new Date("2026-01-03T00:30:00Z"))).toEqual({ from: "2025-12-28", to: "2026-01-03" });
    expect(analyticsRange("ytd", new Date("2026-10-22T22:30:00Z"))).toEqual({ from: "2026-01-01", to: "2026-10-22" });
  });
  it("sums the actual platform-keyed daily series", () => {
    const view = analyticsView(overview, posts, "all");
    expect(view.daily.map((point) => point.engagements)).toEqual([25, 50]);
    expect(view.peak?.date).toBe("2026-10-02");
    expect(view.platformRows.map((row) => row.engagements)).toEqual([30, 45]);
  });
  it("filters every available metric without inventing unsupported channel metrics", () => {
    const view = analyticsView(overview, posts, "instagram");
    expect(view.metrics).toMatchObject({ totalReach: 600, totalPosts: 2, totalEngagements: 45, totalClicks: null, followerGrowth: null });
    expect(view.posts.map((post) => post.postId)).toEqual(["p2"]);
    expect(view.daily.map((point) => point.engagements)).toEqual([15, 30]);
    expect(analyticsView(overview, posts, "x").hasActivity).toBe(false);
  });
  it("exports only selected channel data with valid quoted captions", () => {
    const csv = analyticsCsv(overview, "instagram", posts);
    expect(csv).toContain('"Launch, with ""benefits""\nand details"');
    expect(csv).toContain('"2026-10-01","15"');
    expect(csv).not.toContain("Customer story");
    expect(csv).toContain('"totalClicks",""');
  });
});

describe("AnalyticsOverview", () => {
  it("shows a layout-matched loading state until both requests settle", async () => {
    let resolvePosts!: (value: Awaited<ReturnType<typeof socialMediaApi.getPostPerformance>>) => void;
    vi.mocked(socialMediaApi.getPostPerformance).mockReturnValue(new Promise((resolve) => { resolvePosts = resolve; }));
    renderScreen();
    expect(screen.getByRole("status", { name: "Loading analytics" })).toBeTruthy();
    await waitFor(() => expect(socialMediaApi.getAnalyticsOverview).toHaveBeenCalled());
    expect(screen.queryByText("Total reach")).toBeNull();
    resolvePosts({ fromDate: overview.fromDate, toDate: overview.toDate, items: posts });
    expect(await screen.findByText("Total reach")).toBeTruthy();
  });
  it("renders metrics, links and a keyboard-accessible exact data view", async () => {
    const user = userEvent.setup();
    renderScreen();
    expect(await screen.findByText("Total reach")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Customer story/ }).getAttribute("href")).toBe("/dashboard/posts/p1");
    const viewData = screen.getByRole("button", { name: "View data" });
    viewData.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("columnheader", { name: "Date (UTC)" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "25" })).toBeTruthy();
    expect(screen.queryByText("AI insight")).toBeNull();
  });
  it("filters the dashboard by channel without extra requests", async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText("Total reach");
    await user.click(screen.getByRole("combobox", { name: "Filter by channel" }));
    await user.click(await screen.findByRole("option", { name: "Instagram" }));
    expect(screen.queryByRole("link", { name: /Customer story/ })).toBeNull();
    expect(screen.queryByText("net new followers")).toBeNull();
    expect(socialMediaApi.getAnalyticsOverview).toHaveBeenCalledTimes(1);
  });
  it("provides an actionable empty state instead of fictional chart data", async () => {
    vi.mocked(socialMediaApi.getAnalyticsOverview).mockResolvedValue({ ...overview, metrics: { totalPosts: 0, totalReach: 0, totalImpressions: 0, totalEngagements: 0, avgEngagementRate: 0, followerGrowth: 0, totalClicks: 0 }, engagementSeries: [], platformComparison: [], reachByPlatform: [] });
    vi.mocked(socialMediaApi.getPostPerformance).mockResolvedValue({ fromDate: overview.fromDate, toDate: overview.toDate, items: [] });
    renderScreen();
    expect(await screen.findByRole("link", { name: "Create a post" })).toBeTruthy();
    expect(screen.queryByRole("img", { name: "Engagement chart" })).toBeNull();
  });
  it("ignores stale responses after the date range changes", async () => {
    const user = userEvent.setup();
    let resolveOld!: (value: OverviewData) => void;
    vi.mocked(socialMediaApi.getAnalyticsOverview)
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ ...overview, metrics: { ...overview.metrics, totalReach: 1800 } });
    renderScreen();
    await user.click(screen.getByRole("combobox", { name: "Date range" }));
    await user.click(await screen.findByRole("option", { name: "Last 7 days" }));
    expect(await screen.findByText("1,800")).toBeTruthy();
    resolveOld({ ...overview, metrics: { ...overview.metrics, totalReach: 9999 } });
    await waitFor(() => expect(screen.queryByText("9,999")).toBeNull());
    expect(socialMediaApi.getAnalyticsOverview).toHaveBeenLastCalledWith("workspace-1", analyticsRange("7d"));
  });
  it("ranks posts by the selected metric", async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText("Total reach");
    await user.click(screen.getByRole("combobox", { name: "Rank posts by" }));
    await user.click(await screen.findByRole("option", { name: "Reach" }));
    const links = screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/dashboard/posts/p"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/dashboard/posts/p2", "/dashboard/posts/p1"]);
  });
  it("retries failed reports", async () => {
    const user = userEvent.setup();
    vi.mocked(socialMediaApi.getAnalyticsOverview).mockRejectedValueOnce(new Error("Analytics unavailable"));
    renderScreen();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Total reach")).toBeTruthy();
    expect(socialMediaApi.getAnalyticsOverview).toHaveBeenCalledTimes(2);
  });
  it("keeps the summary available when post rankings fail", async () => {
    vi.mocked(socialMediaApi.getPostPerformance).mockRejectedValue(new Error("Posts unavailable"));
    renderScreen();
    expect(await screen.findByText("Total reach")).toBeTruthy();
    expect(within(screen.getByRole("alert")).getByText(/Post rankings couldn’t/)).toBeTruthy();
  });
  it("downloads a CSV for the current report", async () => {
    const user = userEvent.setup();
    const create = vi.fn(() => "blob:analytics");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderScreen();
    await screen.findByText("Total reach");
    await user.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(create).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
    expect(screen.getByText("Report downloaded")).toBeTruthy();
    click.mockRestore();
  });
  it("has no detected accessibility violations", async () => {
    const { container } = renderScreen();
    await screen.findByText("Total reach");
    const result = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});