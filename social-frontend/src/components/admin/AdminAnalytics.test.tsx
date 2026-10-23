import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { axe } from "vitest-axe";
import adminApi from "@/api/endpoints/admin.api";
import adminReducer from "@/features/admin/adminSlice";
import authReducer, { loginSuccess, logout } from "@/features/auth/authSlice";
import { fetchAdminAnalytics } from "@/features/admin/adminThunks";
import type { AdminAnalytics as AnalyticsData } from "@/types/admin";
import type { User } from "@/types/auth";
import AdminAnalytics from "./AdminAnalytics";
import AdminMarketingAnalytics from "./AdminMarketingAnalytics";

vi.mock("@/api/endpoints/admin.api", () => ({ default: { getAnalytics: vi.fn(), getMarketingAnalytics: vi.fn() } }));
vi.mock("recharts", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Empty = () => null;
  return {
    ResponsiveContainer: Container, LineChart: Container, BarChart: Container, PieChart: Container,
    CartesianGrid: Empty, Cell: Empty, Legend: Empty, Line: Empty, Tooltip: Empty, XAxis: Empty, YAxis: Empty,
    Bar: ({ name }: { name: string }) => <span>{name}</span>,
    Pie: ({ data }: { data: { name: string; value: number }[] }) => <ul>{data.map((row) => <li key={row.name}>{row.name}: {row.value}</li>)}</ul>,
  };
});

const user: User = { id: "admin", email: "admin@example.com", name: "Admin", isPlatformAdmin: true, workspaceId: "workspace", workspaceName: "Workspace", socialPermissionLevel: "admin", plan: "starter" };
const analytics: AnalyticsData = { postsOverTime: [{ date: "2026-10-23", posts: 11 }], platformMix: [{ platform: "linkedin", count: 4 }], planDistribution: [{ plan: "starter", count: 3 }, { plan: "growth", count: 2 }, { plan: "enterprise", count: 1 }] };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function renderAnalytics(marketing = false) {
  const store = configureStore({ reducer: { admin: adminReducer, auth: authReducer } });
  store.dispatch(loginSuccess({ user, accessToken: "session-a" }));
  return { ...render(<Provider store={store}><AdminAnalytics />{marketing && <AdminMarketingAnalytics />}</Provider>), store };
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  vi.mocked(adminApi.getAnalytics).mockResolvedValue(analytics);
  vi.mocked(adminApi.getMarketingAnalytics).mockResolvedValue({ pageViews30d: 10, signupClicks30d: 3, contactClicks30d: 2, contacts30d: 1, newContacts: 1, inProgressContacts: 0, resolvedContacts: 0, daily: [] });
});
afterEach(cleanup);

describe("AdminAnalytics", () => {
  it("uses verified catalog aliases and a single connected-account chart", async () => {
    renderAnalytics();
    expect(await screen.findByText("Free: 3")).toBeTruthy();
    expect(screen.getByText("Pro: 2")).toBeTruthy();
    expect(screen.getByText("Growth: 1")).toBeTruthy();
    expect(screen.getAllByRole("heading", { name: "Connected accounts" })).toHaveLength(1);
    expect(screen.getByText("Currently active accounts by social platform, not a 30-day total.")).toBeTruthy();
    expect(screen.queryByText("Platform mix")).toBeNull();
  });

  it("hides empty charts on API failure and supports retry", async () => {
    vi.mocked(adminApi.getAnalytics).mockRejectedValueOnce(new Error("Offline"));
    renderAnalytics();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Posts over time")).toBeNull();
    expect(screen.queryByText("Plan distribution")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry product analytics" }));
    expect(await screen.findByText("Free: 3")).toBeTruthy();
  });

  it("loads without zero charts and only requests the supported fixed report", async () => {
    const pending = deferred<AnalyticsData>();
    vi.mocked(adminApi.getAnalytics).mockReturnValue(pending.promise);
    renderAnalytics();
    expect(screen.getByRole("status", { name: "Loading product analytics" })).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(adminApi.getAnalytics).toHaveBeenCalledWith(undefined, expect.any(AbortSignal));
    await act(async () => pending.resolve(analytics));
    expect(screen.getByText(/including today \(UTC\)/)).toBeTruthy();
    expect(screen.getByText(/including inactive workspaces/)).toBeTruthy();
    expect(screen.queryByText(/subscribers|subscriptions/i)).toBeNull();
  });

  it("provides readable equivalents of chart data", async () => {
    renderAnalytics();
    await screen.findByText("Free: 3");
    fireEvent.click(screen.getByText("View daily publishing data"));
    const table = within(screen.getByRole("table", { name: /Published posts in the last 30 days/ }));
    expect(table.getByRole("columnheader", { name: "Date (UTC)" })).toBeTruthy();
    expect(table.getByRole("rowheader", { name: "2026-10-23" })).toBeTruthy();
    expect(table.getByRole("cell", { name: "11" })).toBeTruthy();
    expect(within(screen.getByLabelText("Active accounts by platform")).getByText("4")).toBeTruthy();
    expect(within(screen.getByLabelText("Workspaces by plan")).getByText("3 workspaces")).toBeTruthy();
  });

  it.each([{ postsOverTime: [], message: "No daily publishing data returned for the last 30 days." }, { postsOverTime: [{ date: "2026-10-23", posts: 0 }], message: "No published posts recorded in the last 30 days." }])("handles missing versus zero daily data and refreshes", async ({ postsOverTime, message }) => {
    vi.mocked(adminApi.getAnalytics).mockResolvedValueOnce({ postsOverTime, platformMix: [], planDistribution: [{ plan: "starter", count: 0 }] });
    renderAnalytics();
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByText("No active connected accounts recorded.")).toBeTruthy();
    expect(screen.getByText("No workspaces recorded in the plan distribution.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Refresh product analytics" }));
    expect(await screen.findByText("Free: 3")).toBeTruthy();
  });

  it("retains labelled stale data on refresh failure and blocks duplicate refreshes", async () => {
    renderAnalytics();
    await screen.findByText("Free: 3");
    const pending = deferred<AnalyticsData>();
    vi.mocked(adminApi.getAnalytics).mockReturnValueOnce(pending.promise);
    const refresh = screen.getByRole("button", { name: "Refresh product analytics" });
    fireEvent.click(refresh); fireEvent.click(refresh);
    expect(adminApi.getAnalytics).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status").textContent).toContain("previously loaded data");
    await act(async () => pending.reject(new Error("Offline")));
    expect(screen.getByRole("alert").textContent).toContain("out of date");
    expect(screen.getByText("Free: 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry product analytics" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("resets reports on session change and rejects late failures from the old session", async () => {
    const { store } = renderAnalytics();
    await screen.findByText("Free: 3");
    const old = deferred<AnalyticsData>();
    const next = deferred<AnalyticsData>();
    vi.mocked(adminApi.getAnalytics).mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    fireEvent.click(screen.getByRole("button", { name: "Refresh product analytics" }));
    act(() => { store.dispatch(loginSuccess({ user, accessToken: "session-b" })); });
    expect(screen.queryByText("Free: 3")).toBeNull();
    await act(async () => next.resolve({ ...analytics, planDistribution: [{ plan: "starter", count: 8 }] }));
    await act(async () => old.reject(new Error("Late failure")));
    expect(screen.getByText("Free: 8")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("ignores unrelated Redux data and removes totals on logout", async () => {
    const { store } = renderAnalytics();
    await screen.findByText("Free: 3");
    act(() => { store.dispatch(fetchAdminAnalytics.fulfilled({ ...analytics, planDistribution: [{ plan: "starter", count: 999 }] }, "unrelated", undefined)); });
    expect(screen.queryByText("Free: 999")).toBeNull();
    act(() => { store.dispatch(logout()); });
    expect(screen.queryByText("Free: 3")).toBeNull();
  });

  it("aborts the dispatched thunk when unmounted", async () => {
    const pending = deferred<AnalyticsData>();
    vi.mocked(adminApi.getAnalytics).mockReturnValue(pending.promise);
    const { unmount, store } = renderAnalytics();
    unmount();
    await waitFor(() => expect(store.getState().admin.analyticsLoading).toBe(false));
    await act(async () => pending.resolve(analytics));
    expect(store.getState().admin.analytics).toBeNull();
  });

  it("keeps product and marketing on one accessible page with one h1", async () => {
    const { container } = renderAnalytics(true);
    await screen.findByText("Free: 3");
    await screen.findByText("Page views");
    fireEvent.click(screen.getByText("View daily publishing data"));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 2, name: "Product analytics" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Marketing analytics" })).toBeTruthy();
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });
});