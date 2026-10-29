import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { axe } from "vitest-axe";
import { useDashboardHome } from "@/hooks/useDashboardHome";
import { fetchDashboardHomeCached, getCachedDashboardHome, isDashboardHomeFresh, type DashboardHomePayload } from "@/lib/dashboard-cache";
import type { SocialPost } from "@/types/social-media.types";
import SocialDashboard from "./SocialDashboard";

vi.mock("@/lib/dashboard-cache", () => ({
  fetchDashboardHomeCached: vi.fn(),
  getCachedDashboardHome: vi.fn(),
  isDashboardHomeFresh: vi.fn(),
}));

const home: DashboardHomePayload = {
  stats: {
    connectedAccounts: 2,
    expiredAccounts: 0,
    postsThisWeek: 8,
    totalReach: 12750,
    avgEngagementRate: 0.045,
    usage: {
      plan: "growth",
      postsThisMonth: { used: 18, limit: 100 },
      accounts: { used: 2, limit: 5 },
      templates: { used: 4, limit: null },
      approvalWorkflow: true,
      brandVoice: true,
    },
    accounts: [
      { id: "account-1", platform: "facebook", accountName: "Acme Facebook", followerCount: 1250, tokenStatus: "active", isDefault: true },
      { id: "account-2", platform: "instagram", accountName: "Acme Instagram", followerCount: 2450, tokenStatus: "active", isDefault: false },
    ],
  },
  activity: [],
  recommendations: [{ topic: "A customer story & what changed", reason: "Show your product in action." }],
  scheduledPosts: [],
};

function scheduledPost(id: string, scheduledAt: string): SocialPost {
  return {
    id, orgId: "workspace-1", createdBy: "user-1", title: `Post ${id}`, status: "scheduled", scheduledAt,
    publishedAt: null, approvalStatus: "not_required", approvedBy: null, templateId: null, aiPrompt: null,
    imageUrl: null, imageSource: "none", platforms: [], createdAt: "2026-10-01T10:00:00Z", updatedAt: "2026-10-01T10:00:00Z",
  };
}

function renderDashboard() {
  const store = configureStore({ reducer: { auth: () => ({ user: { workspaceId: "workspace-1", workspaceName: "Acme", name: "Alex Morgan", plan: "growth" } }) } });
  return render(<Provider store={store}><SocialDashboard /></Provider>);
}

const networkAttempts: string[] = [];
function blockNetwork(transport: string): never {
  networkAttempts.push(transport);
  throw new Error(`Unmocked ${transport} is forbidden in dashboard tests`);
}

beforeEach(() => {
  networkAttempts.length = 0;
  vi.stubGlobal("fetch", vi.fn(() => blockNetwork("fetch")));
  vi.stubGlobal("WebSocket", class { constructor() { blockNetwork("WebSocket"); } });
  vi.spyOn(XMLHttpRequest.prototype, "send").mockImplementation(() => blockNetwork("XMLHttpRequest"));
  vi.mocked(getCachedDashboardHome).mockReturnValue(null);
  vi.mocked(isDashboardHomeFresh).mockReturnValue(false);
  vi.mocked(fetchDashboardHomeCached).mockResolvedValue(home);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  expect(networkAttempts).toEqual([]);
});

describe("SocialDashboard", () => {
  it("renders accurate metrics, useful actions and a single page heading", async () => {
    renderDashboard();
    await screen.findByText("Posts created");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("Last 7 days · all statuses")).toBeTruthy();
    expect(screen.getByText("12,750")).toBeTruthy();
    expect(screen.getByText("8", { exact: true })).toBeTruthy();
    expect(screen.getByText("4.5%", { exact: true })).toBeTruthy();
    expect(screen.getByText("Last 30 days · reported reach")).toBeTruthy();
    expect(screen.getByText("Last 30 days · per impression")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Plan content/ }).getAttribute("href")).toBe("/dashboard/content-studio/planner");
    expect(screen.getByRole("link", { name: /Continue a draft/ }).getAttribute("href")).toBe("/dashboard/posts/drafts");
    expect(fetchDashboardHomeCached).toHaveBeenCalledTimes(1);
  });

  it("shows a full skeleton while the initial request is pending", () => {
    vi.mocked(fetchDashboardHomeCached).mockReturnValue(new Promise(() => {}));
    renderDashboard();
    expect(screen.getByRole("status", { name: "Loading dashboard" })).toBeTruthy();
    expect(screen.queryByText("Posts created")).toBeNull();
    expect(screen.queryByText("Bring your channels together")).toBeNull();
  });

  it("does not invent zero metrics or onboarding after a request failure", async () => {
    vi.mocked(fetchDashboardHomeCached).mockRejectedValue(new Error("Offline"));
    renderDashboard();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Posts created")).toBeNull();
    expect(screen.queryByText("Bring your channels together")).toBeNull();
  });

  it("retries an initial load failure", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchDashboardHomeCached).mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(home);
    renderDashboard();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Posts created")).toBeTruthy();
    expect(fetchDashboardHomeCached).toHaveBeenLastCalledWith("workspace-1", { force: true });
  });

  it("offers account onboarding and draft actions for a new workspace", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchDashboardHomeCached).mockResolvedValue({ ...home, stats: { ...home.stats, connectedAccounts: 0, accounts: [] }, recommendations: [] });
    renderDashboard();
    expect(await screen.findByRole("heading", { name: "Bring your channels together" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Connect an account/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse drafts" })).toBeTruthy();
    expect(screen.queryByText("All connections healthy")).toBeNull();
    await user.click(screen.getByText("A little inspiration"));
    expect(screen.getByRole("link", { name: /Set up brand profile/ })).toBeTruthy();
  });

  it("shows connection and post allowance issues with real actions", async () => {
    vi.mocked(fetchDashboardHomeCached).mockResolvedValue({ ...home, stats: { ...home.stats, expiredAccounts: 1, accounts: [{ ...home.stats.accounts[0], tokenStatus: "expired" }], usage: { ...home.stats.usage, postsThisMonth: { used: 100, limit: 100 } } } });
    renderDashboard();
    expect(await screen.findByText("Reconnect needed")).toBeTruthy();
    expect(screen.getByRole("link", { name: /1 account needs attention/ }).getAttribute("href")).toBe("/dashboard/accounts");
    expect(screen.getByRole("link", { name: /Monthly post allowance reached/ }).getAttribute("href")).toBe("/dashboard/billing");
  });

  it("flags expiring connections without marking active accounts unhealthy", async () => {
    vi.mocked(fetchDashboardHomeCached).mockResolvedValue({ ...home, stats: { ...home.stats, accounts: [home.stats.accounts[0], { ...home.stats.accounts[1], tokenStatus: "expires_soon" }] } });
    renderDashboard();
    expect(await screen.findByText("Expires soon")).toBeTruthy();
    expect(screen.getByText("Connected", { exact: true })).toBeTruthy();
    expect(screen.getByRole("link", { name: /1 account needs attention/ })).toBeTruthy();
  });

  it("orders queue previews by schedule and does not present them as a total", async () => {
    vi.mocked(fetchDashboardHomeCached).mockResolvedValue({ ...home, scheduledPosts: [scheduledPost("later", "2026-12-03T12:00:00Z"), scheduledPost("earlier", "2026-12-01T12:00:00Z")] });
    renderDashboard();
    await screen.findByText("Post earlier");
    const links = screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/dashboard/posts/earlier") || link.getAttribute("href")?.startsWith("/dashboard/posts/later"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/dashboard/posts/earlier", "/dashboard/posts/later"]);
    expect(screen.getByText(/Queue preview is not the total/)).toBeTruthy();
  });

  it("preserves a selected content idea in the composer link", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(await screen.findByText("A little inspiration"));
    const link = await screen.findByRole("link", { name: /A customer story & what changed/ });
    expect(new URL(link.getAttribute("href")!, "http://localhost").searchParams.get("topic")).toBe(home.recommendations[0].topic);
  });

  it("distinguishes unlimited usage from a measured percentage", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(await screen.findByText("Workspace usage"));
    expect(screen.getByText("4 / Unlimited")).toBeTruthy();
    expect(screen.queryByRole("progressbar", { name: "Saved templates" })).toBeNull();
    expect(screen.getByText("Brand voice feature")).toBeTruthy();
    expect(screen.getByText("Included")).toBeTruthy();
  });

  it("puts creation and canonical planning in the header and the queue before secondary metrics", async () => {
    renderDashboard();
    const queue = await screen.findByRole("heading", { name: "Next in your queue" });
    const header = screen.getByRole("banner");
    const actions = within(header).getAllByRole("link");
    expect(actions.map((link) => link.textContent)).toEqual(["Create a post", "Plan content", "Calendar"]);
    expect(actions.map((link) => link.getAttribute("href"))).toEqual([
      "/dashboard/content-studio/generate", "/dashboard/content-studio/planner", "/dashboard/calendar",
    ]);
    const metrics = screen.getByRole("region", { name: "Workspace metrics" });
    expect(queue.compareDocumentPosition(metrics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(metrics.compareDocumentPosition(screen.getByText("Recent activity")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Quick actions" })).toBeNull();
  });

  it("omits an empty attention section for a healthy workspace", async () => {
    renderDashboard();
    await screen.findByText("Posts created");
    expect(screen.queryByRole("heading", { name: "Needs attention" })).toBeNull();
    expect(screen.queryByText(/No connection or post allowance issues/)).toBeNull();
  });

  it("does not duplicate onboarding with an empty attention section", async () => {
    vi.mocked(fetchDashboardHomeCached).mockResolvedValue({ ...home, stats: { ...home.stats, connectedAccounts: 0, accounts: [] } });
    renderDashboard();
    await screen.findByText("Bring your channels together");
    expect(screen.queryByRole("heading", { name: "Needs attention" })).toBeNull();
  });

  it("shows allowance-only attention even without a connection issue", async () => {
    vi.mocked(fetchDashboardHomeCached).mockResolvedValue({ ...home, stats: { ...home.stats, usage: { ...home.stats.usage, postsThisMonth: { used: 0, limit: 0 } } } });
    renderDashboard();
    expect(await screen.findByRole("heading", { name: "Needs attention" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Monthly post allowance reached/ }).getAttribute("href")).toBe("/dashboard/billing");
    expect(screen.queryByRole("link", { name: /account.*attention/ })).toBeNull();
  });

  it("keeps summary connection issues actionable when account details are absent", async () => {
    vi.mocked(fetchDashboardHomeCached).mockResolvedValue({ ...home, stats: { ...home.stats, accounts: [], expiredAccounts: 2 } });
    renderDashboard();
    expect(await screen.findByRole("link", { name: /2 accounts need attention/ })).toBeTruthy();
  });

  it("keeps activity, inspiration and usage collapsed and opens them without extra requests", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText("Posts created");
    for (const title of ["Recent activity", "A little inspiration", "Workspace usage"]) {
      const summary = screen.getByText(title).closest("summary")!;
      const details = summary.closest("details")!;
      expect(details.open).toBe(false);
      await user.click(summary);
      expect(details.open).toBe(true);
    }
    expect(screen.getByRole("link", { name: /All posts/ }).getAttribute("href")).toBe("/dashboard/posts");
    expect(screen.getByRole("link", { name: /Media library/ }).getAttribute("href")).toBe("/dashboard/content-studio/media");
    expect(screen.getByRole("link", { name: /Manage plan/ }).getAttribute("href")).toBe("/dashboard/billing");
    expect(fetchDashboardHomeCached).toHaveBeenCalledTimes(1);
    expect(fetchDashboardHomeCached).toHaveBeenCalledWith("workspace-1", { force: false });
    expect(networkAttempts).toEqual([]);
  });

  it("preserves exact metric values and reporting periods including real zeros", async () => {
    vi.mocked(fetchDashboardHomeCached).mockResolvedValue({ ...home, stats: { ...home.stats, postsThisWeek: 0, totalReach: 0, avgEngagementRate: 0 } });
    renderDashboard();
    const metrics = await screen.findByRole("region", { name: "Workspace metrics" });
    expect(within(metrics).getByRole("link", { name: "Posts created 0 Last 7 days · all statuses" })).toBeTruthy();
    expect(within(metrics).getByRole("link", { name: "Total reach 0 Last 30 days · reported reach" })).toBeTruthy();
    expect(within(metrics).getByRole("link", { name: "Engagement rate 0.0% Last 30 days · per impression" })).toBeTruthy();
    expect(within(metrics).getByRole("link", { name: /Connected accounts 2/ })).toBeTruthy();
  });

  it("never treats unlimited posts or accounts as exhausted", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchDashboardHomeCached).mockResolvedValue({ ...home, stats: { ...home.stats, usage: { ...home.stats.usage, postsThisMonth: { used: 250, limit: null }, accounts: { used: 2, limit: null }, brandVoice: false } } });
    renderDashboard();
    await user.click(await screen.findByText("Workspace usage"));
    expect(screen.getByText("250 / Unlimited")).toBeTruthy();
    expect(screen.getByText("2 / Unlimited")).toBeTruthy();
    expect(screen.getByText("Not included")).toBeTruthy();
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    expect(screen.queryByRole("heading", { name: "Needs attention" })).toBeNull();
  });

  it("keeps cached overview and queue visible after a failed refresh", async () => {
    const user = userEvent.setup();
    vi.mocked(getCachedDashboardHome).mockReturnValue({ ...home, scheduledPosts: [scheduledPost("cached", "2026-12-01T12:00:00Z")] });
    vi.mocked(isDashboardHomeFresh).mockReturnValue(true);
    vi.mocked(fetchDashboardHomeCached).mockRejectedValue(new Error("Offline"));
    renderDashboard();
    await user.click(screen.getByRole("button", { name: "Refresh dashboard" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Showing your previously loaded overview.");
    expect(screen.getByText("Post cached")).toBeTruthy();
    expect(screen.getByText("12,750")).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Loading dashboard" })).toBeNull();
  });

  it("can refresh using the keyboard without hiding cached content", async () => {
    const user = userEvent.setup();
    let resolveRefresh!: (value: DashboardHomePayload) => void;
    renderDashboard();
    await screen.findByText("Posts created");
    vi.mocked(fetchDashboardHomeCached).mockReturnValueOnce(new Promise((resolve) => { resolveRefresh = resolve; }));
    screen.getByRole("button", { name: "Refresh dashboard" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("Refreshing your workspace…")).toBeTruthy();
    expect(screen.getByText("Posts created")).toBeTruthy();
    await act(async () => resolveRefresh(home));
    expect(screen.queryByText("Refreshing your workspace…")).toBeNull();
  });

  it("passes automated accessibility checks", async () => {
    const { container } = renderDashboard();
    await screen.findByText("Posts created");
    const result = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});

describe("useDashboardHome", () => {
  it("reuses fresh cached payloads without a network request", () => {
    vi.mocked(getCachedDashboardHome).mockReturnValue(home);
    vi.mocked(isDashboardHomeFresh).mockReturnValue(true);
    const { result } = renderHook(() => useDashboardHome("workspace-1"));
    expect(result.current.data).toBe(home);
    expect(result.current.loading).toBe(false);
    expect(fetchDashboardHomeCached).not.toHaveBeenCalled();
  });

  it("discards older workspace responses and manual refresh results", async () => {
    let resolveOld!: (value: DashboardHomePayload) => void;
    let resolveRefresh!: (value: DashboardHomePayload) => void;
    vi.mocked(fetchDashboardHomeCached)
      .mockResolvedValueOnce(home)
      .mockReturnValueOnce(new Promise((resolve) => { resolveRefresh = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
    const { result, rerender } = renderHook(({ workspace }) => useDashboardHome(workspace), { initialProps: { workspace: "workspace-1" } });
    await waitFor(() => expect(result.current.data).toBe(home));
    act(() => { void result.current.reload(); });
    rerender({ workspace: "workspace-2" });
    expect(result.current.data).toBeNull();
    const next = { ...home, stats: { ...home.stats, totalReach: 888 } };
    await act(async () => resolveOld(next));
    await act(async () => resolveRefresh(home));
    expect(result.current.data).toBe(next);
    expect(result.current.refreshing).toBe(false);
  });

  it("keeps stale data visible and explains a failed background refresh", async () => {
    vi.mocked(getCachedDashboardHome).mockReturnValue(home);
    vi.mocked(fetchDashboardHomeCached).mockRejectedValue(new Error("Offline"));
    const { result } = renderHook(() => useDashboardHome("workspace-1"));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data).toBe(home);
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
  });
});