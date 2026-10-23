import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { axe } from "vitest-axe";
import adminApi from "@/api/endpoints/admin.api";
import adminReducer from "@/features/admin/adminSlice";
import { fetchAdminOverview } from "@/features/admin/adminThunks";
import authReducer, { loginSuccess, logout } from "@/features/auth/authSlice";
import { persistSession } from "@/lib/auth/session";
import type { AdminOverviewStats } from "@/types/admin";
import type { User } from "@/types/auth";
import AdminOverview from "./AdminOverview";

vi.mock("@/api/endpoints/admin.api", () => ({ default: { getOverview: vi.fn() } }));

const user: User = { id: "admin", email: "admin@example.com", name: "Admin", isPlatformAdmin: true, workspaceId: "workspace", workspaceName: "Workspace", socialPermissionLevel: "admin", plan: "starter" };
const overview: AdminOverviewStats = { totalUsers: 1234, totalWorkspaces: 36, posts30d: 271, aiUsage30d: 809, failedPublishes30d: 7, mrrEstimateUsd: 999999, userGrowth30dPct: 68.5, planDistribution: [{ plan: "starter", count: 20 }, { plan: "growth", count: 10 }, { plan: "enterprise", count: 6 }] };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function setup() {
  const store = configureStore({ reducer: { admin: adminReducer, auth: authReducer } });
  store.dispatch(loginSuccess({ user, accessToken: "session-a" }));
  const view = render(<Provider store={store}><AdminOverview /></Provider>);
  return { ...view, store };
}
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); vi.mocked(adminApi.getOverview).mockResolvedValue(overview); });
afterEach(cleanup);

describe("AdminOverview", () => {
  it("shows skeletons without fabricated zero totals", () => {
    vi.mocked(adminApi.getOverview).mockReturnValue(new Promise(() => {}));
    setup();
    expect(screen.getByRole("status", { name: "Loading overview" })).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Total users" })).toBeNull();
  });

  it("renders only supported aggregate numbers and workspace plan counts", async () => {
    const { container } = setup();
    await screen.findByText("1,234");
    for (const value of ["36", "271", "809", "7"]) expect(screen.getByText(value)).toBeTruthy();
    expect(screen.getByText("20 workspaces")).toBeTruthy();
    expect(screen.getByText("10 workspaces")).toBeTruthy();
    expect(screen.getByText("6 workspaces")).toBeTruthy();
    expect(screen.getByRole("meter", { name: "Free workspaces" }).getAttribute("aria-valuenow")).toBe("20");
    expect(screen.getByRole("meter", { name: "Pro workspaces" })).toBeTruthy();
    expect(screen.getByRole("meter", { name: "Growth workspaces" })).toBeTruthy();
    expect(screen.getByText(/including inactive workspaces/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/999,999|68\.5|revenue|MRR|subscriptions|signups trend|user growth|prior/i);
    expect(container.querySelector(".lucide-arrow-up-right, .lucide-trending-up")).toBeNull();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("links all six admin shortcuts to existing admin routes", async () => {
    setup();
    await screen.findByText("1,234");
    const nav = within(screen.getByRole("navigation", { name: "Admin shortcuts" }));
    for (const [name, route] of [["Users", "users"], ["Workspaces", "workspaces"], ["Enquiries", "contacts"], ["Analytics", "analytics"], ["Plans", "pricing"], ["Coupons", "coupons"]]) {
      expect(nav.getByRole("link", { name: new RegExp(`^${name}`) }).getAttribute("href")).toBe(`/admin/${route}`);
    }
  });

  it("reports failure without zero metrics or charts and retries", async () => {
    vi.mocked(adminApi.getOverview).mockRejectedValueOnce(new Error("Offline"));
    setup();
    expect((await screen.findByRole("alert")).textContent).toContain("No totals are available");
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Total users" })).toBeNull();
    expect(screen.queryByRole("meter")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry overview" }));
    expect(await screen.findByText("1,234")).toBeTruthy();
  });

  it("keeps explicitly stale data while refreshing and on refresh failure", async () => {
    const pending = deferred<AdminOverviewStats>();
    setup();
    await screen.findByText("1,234");
    vi.mocked(adminApi.getOverview).mockReturnValueOnce(pending.promise);
    const refresh = screen.getByRole("button", { name: "Refresh overview" });
    fireEvent.click(refresh); fireEvent.click(refresh);
    expect(adminApi.getOverview).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status").textContent).toContain("previously loaded data");
    expect(screen.getByText("1,234")).toBeTruthy();
    await act(async () => pending.reject(new Error("Offline")));
    expect(screen.getByRole("alert").textContent).toContain("out of date");
    expect(screen.getByText("1,234")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry overview" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("shows real zero totals and an empty distribution with refresh available", async () => {
    vi.mocked(adminApi.getOverview).mockResolvedValueOnce({ ...overview, totalUsers: 0, totalWorkspaces: 0, posts30d: 0, aiUsage30d: 0, failedPublishes30d: 0, planDistribution: [{ plan: "starter", count: 0 }] });
    setup();
    await screen.findByText("No workspaces recorded in the plan distribution.");
    expect(screen.getAllByText("0")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Refresh overview" }));
    expect(await screen.findByText("1,234")).toBeTruthy();
  });

  it("resets loaded state across sessions and ignores late old-session results", async () => {
    const old = deferred<AdminOverviewStats>();
    const next = deferred<AdminOverviewStats>();
    const { store } = setup();
    await screen.findByText("1,234");
    vi.mocked(adminApi.getOverview).mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    fireEvent.click(screen.getByRole("button", { name: "Refresh overview" }));
    act(() => { store.dispatch(loginSuccess({ user: { ...user, id: "other" }, accessToken: "session-b" })); });
    expect(screen.queryByText("1,234")).toBeNull();
    await act(async () => next.resolve({ ...overview, totalUsers: 9876 }));
    await act(async () => old.resolve(overview));
    expect(screen.getByText("9,876")).toBeTruthy();
    expect(screen.queryByText("1,234")).toBeNull();
  });

  it("ignores stored-session changes before Redux catches up", async () => {
    const pending = deferred<AdminOverviewStats>();
    vi.mocked(adminApi.getOverview).mockReturnValue(pending.promise);
    setup();
    persistSession({ user, accessToken: "session-b" });
    await act(async () => pending.resolve(overview));
    expect(screen.queryByText("1,234")).toBeNull();
  });

  it("does not display unrelated Redux fulfillment or cached session data", async () => {
    const { store } = setup();
    await screen.findByText("1,234");
    act(() => { store.dispatch(fetchAdminOverview.fulfilled({ ...overview, totalUsers: 8888 }, "unrelated")); });
    expect(screen.queryByText("8,888")).toBeNull();
    act(() => { store.dispatch(logout()); });
    expect(screen.queryByText("1,234")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("administrator access");
  });

  it("aborts the dispatched thunk on unmount", async () => {
    const pending = deferred<AdminOverviewStats>();
    vi.mocked(adminApi.getOverview).mockReturnValue(pending.promise);
    const { store, unmount } = setup();
    unmount();
    await waitFor(() => expect(store.getState().admin.overviewLoading).toBe(false));
    await act(async () => pending.resolve(overview));
    expect(store.getState().admin.overview).toBeNull();
  });

  it("has accessible cards, distribution and shortcut navigation", async () => {
    const { container } = setup();
    await screen.findByText("1,234");
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });
});