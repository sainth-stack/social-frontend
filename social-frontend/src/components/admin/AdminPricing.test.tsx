import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { axe } from "vitest-axe";
import { toast } from "sonner";
import adminApi from "@/api/endpoints/admin.api";
import adminReducer from "@/features/admin/adminSlice";
import { fetchPricingPlans } from "@/features/admin/adminThunks";
import authReducer, { loginSuccess, logout } from "@/features/auth/authSlice";
import type { PricingPlan } from "@/types/admin";
import type { User } from "@/types/auth";
import AdminPricing from "./AdminPricing";

vi.mock("@/api/endpoints/admin.api", () => ({ default: { listPricingPlans: vi.fn(), updatePricingPlan: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const plan: PricingPlan = {
  id: "growth", name: "Pro", tagline: "For creators", priceMonthlyUsd: 99, priceAnnualUsd: 990, priceMonthlyInr: 749, isCustom: false,
  limits: { accounts: null, postsPerMonth: 100, aiTextGenerations: 300, aiImageGenerations: 50, aiVideoGenerations: 0, templates: 30, brandVoice: true, approvalWorkflow: false },
};

const admin: User = { id: "admin", email: "admin@example.com", name: "Admin", isPlatformAdmin: true, workspaceId: "workspace", workspaceName: "Workspace", socialPermissionLevel: "admin", plan: "starter" };

function setup(user = admin) {
  const store = configureStore({ reducer: { admin: adminReducer, auth: authReducer } });
  store.dispatch(loginSuccess({ user, accessToken: "session-one" }));
  return { store, ...render(<Provider store={store}><AdminPricing /></Provider>) };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.mocked(adminApi.listPricingPlans).mockResolvedValue([plan]);
});
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

describe("AdminPricing", () => {
  it("does not fetch or expose plans to a non-admin", () => {
    setup({ ...admin, isPlatformAdmin: false });
    expect(screen.getByRole("alert").textContent).toContain("Platform administrator access is required");
    expect(adminApi.listPricingPlans).not.toHaveBeenCalled();
  });

  it.each(["other-admin", "admin"])("clears drafts and reloads on a new session for %s", async (id) => {
    const { store } = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Edit Pro allowances" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Posts / month" }), { target: { value: "73" } });
    act(() => { store.dispatch(loginSuccess({ user: { ...admin, id }, accessToken: "session-two" })); });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(adminApi.listPricingPlans).toHaveBeenCalledTimes(2));
    fireEvent.click(await screen.findByRole("button", { name: "Edit Pro allowances" }));
    expect((screen.getByRole("textbox", { name: "Posts / month" }) as HTMLInputElement).value).toBe("100");
    expect(adminApi.updatePricingPlan).not.toHaveBeenCalled();
  });

  it.each(["logout", "unmount"])("ignores pending saves after %s", async (action) => {
    let resolve!: (value: PricingPlan) => void;
    vi.mocked(adminApi.updatePricingPlan).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const { store, unmount } = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Edit Pro allowances" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Posts / month" }), { target: { value: "73" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));
    expect(adminApi.updatePricingPlan).toHaveBeenCalledTimes(1);
    act(() => { if (action === "logout") store.dispatch(logout()); else unmount(); });
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => resolve({ ...plan, limits: { ...plan.limits, postsPerMonth: 73 } }));
    expect(toast.success).not.toHaveBeenCalled();
    expect(store.getState().admin.pricingPlans.find((row) => row.id === plan.id)?.limits.postsPerMonth).not.toBe(73);
  });

  it("renders accessible skeletons without activating fallback, then verified INR plans", async () => {
    let resolve!: (plans: PricingPlan[]) => void;
    vi.mocked(adminApi.listPricingPlans).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const { container } = setup();
    expect(screen.getByRole("status", { name: "Loading plans" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Edit.*allowances/ })).toBeNull();
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
    await act(async () => resolve([plan]));
    expect(await screen.findByText("₹749.00")).toBeTruthy();
    expect(screen.getByText("Scale is sales-only.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Edit Scale/ })).toBeNull();
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });

  it("hides default catalog on load failure and retries the live request", async () => {
    vi.mocked(adminApi.listPricingPlans).mockRejectedValueOnce(new Error("Offline"));
    const { container, store } = setup();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(store.getState().admin.pricingIsFallback).toBe(true);
    expect(screen.queryByRole("button", { name: /Edit.*allowances/ })).toBeNull();
    expect(screen.queryByText(/₹|\$/)).toBeNull();
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Retry plans" }));
    expect(await screen.findByText("₹749.00")).toBeTruthy();
    expect(adminApi.listPricingPlans).toHaveBeenCalledTimes(2);
  });

  it("provides an honest empty state and reload", async () => {
    vi.mocked(adminApi.listPricingPlans).mockResolvedValueOnce([]);
    setup();
    expect(await screen.findByText("No plans available")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reload plans" }));
    expect(await screen.findByText("₹749.00")).toBeTruthy();
  });

  it("hides editing while another live catalog request is loading or has failed", async () => {
    const { store } = setup();
    await screen.findByText("₹749.00");
    act(() => { store.dispatch(fetchPricingPlans.pending("reload", undefined)); });
    expect(screen.queryByRole("button", { name: /Edit.*allowances/ })).toBeNull();
    act(() => { store.dispatch(fetchPricingPlans.rejected(new Error("Offline"), "reload", undefined)); });
    expect((screen.getByRole("button", { name: "Edit Pro allowances" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sends dirty-only updates through the existing thunk and preserves drafts through save failure", async () => {
    vi.mocked(adminApi.updatePricingPlan).mockRejectedValueOnce(new Error("Save failed")).mockResolvedValueOnce({ ...plan, limits: { ...plan.limits, postsPerMonth: 0 } });
    setup();
    const edit = await screen.findByRole("button", { name: "Edit Pro allowances" });
    edit.focus();
    fireEvent.click(edit);
    fireEvent.change(screen.getByRole("textbox", { name: "Posts / month" }), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Posts / month" }) as HTMLInputElement).value).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(adminApi.updatePricingPlan).toHaveBeenNthCalledWith(1, "growth", { limits: { postsPerMonth: 0 } });
    expect(adminApi.updatePricingPlan).toHaveBeenNthCalledWith(2, "growth", { limits: { postsPerMonth: 0 } });
    await waitFor(() => expect(document.activeElement).toBe(edit));
  });
});