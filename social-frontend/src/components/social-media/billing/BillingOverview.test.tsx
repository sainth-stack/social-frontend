import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureStore, type UnknownAction } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { axe } from "vitest-axe";
import billingApi from "@/api/endpoints/billing.api";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { authApi } from "@/api/endpoints/auth.api";
import { openSocialCheckoutSession } from "@/lib/razorpayCheckout";
import authReducer from "@/features/auth/authSlice";
import type { User } from "@/types/auth";
import type { BillingPayment, BillingPlanPrice, CheckoutSession, CouponPreview } from "@/types/billing";
import type { SocialDashboardStats } from "@/types/social-media.types";
import BillingOverview from "./BillingOverview";

vi.mock("@/api/endpoints/billing.api", () => ({ default: { listPlans: vi.fn(), listPayments: vi.fn(), validateCoupon: vi.fn(), createCheckout: vi.fn() } }));
vi.mock("@/api/endpoints/social-media.api", () => ({ default: { getUsage: vi.fn(), getDashboardStats: vi.fn() } }));
vi.mock("@/api/endpoints/auth.api", () => ({ authApi: { me: vi.fn() } }));
vi.mock("@/lib/razorpayCheckout", () => ({ openSocialCheckoutSession: vi.fn() }));

const admin: User = { id: "user-1", email: "admin@example.com", name: "Alex", isPlatformAdmin: false, workspaceId: "workspace-1", workspaceName: "Acme", socialPermissionLevel: "admin", plan: "starter" };
const usage: SocialDashboardStats["usage"] = { plan: "starter", postsThisMonth: { used: 8, limit: 10 }, accounts: { used: 2, limit: 2 }, templates: { used: 4, limit: null }, brandVoice: true, approvalWorkflow: false };
const prices: BillingPlanPrice[] = [
  { planKey: "growth", name: "Pro", monthlyPriceInr: 649, monthlyPricePaise: 64950 },
  { planKey: "enterprise", name: "Growth", monthlyPriceInr: 1299, monthlyPricePaise: 129900 },
];
const payment: BillingPayment = { id: "payment-1", workspaceId: "workspace-1", planKey: "growth", status: "paid", amountPaise: 54950, currency: "INR", createdAt: "2026-10-20T10:00:00Z", paidAt: "2026-10-20T10:01:00Z", couponCode: "SAVE" };
const coupon: CouponPreview = { code: "SAVE", planKey: "growth", listPricePaise: 64950, discountPaise: 10000, amountPaise: 54950, currency: "INR" };
const session: CheckoutSession = { mode: "checkout", provider: "razorpay", paymentId: "payment-1", planKey: "growth", orderId: "order-1", keyId: "key-1", amountPaise: 64950, currency: "INR", listPricePaise: 64950, discountPaise: 0 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function renderBilling(overrides: Partial<User> = {}) {
  const initial = { ...authReducer(undefined, { type: "init" }), user: { ...admin, ...overrides }, accessToken: "test-token", isAuthenticated: true, isHydrated: true };
  const store = configureStore({ reducer: { auth: (state: ReturnType<typeof authReducer> = initial, action: UnknownAction) => action.type === "test/user" ? { ...state, user: { ...state.user!, ...(action.payload as Partial<User>) } } : authReducer(state, action) } });
  return { ...render(<Provider store={store}><BillingOverview /></Provider>), store };
}

async function openCheckout() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Upgrade to Pro" }));
  return user;
}

beforeEach(() => {
  vi.mocked(socialMediaApi.getUsage).mockReset().mockResolvedValue(usage);
  vi.mocked(billingApi.listPlans).mockReset().mockResolvedValue(prices);
  vi.mocked(billingApi.listPayments).mockReset().mockResolvedValue([]);
  vi.mocked(billingApi.validateCoupon).mockReset().mockResolvedValue(coupon);
  vi.mocked(billingApi.createCheckout).mockReset().mockResolvedValue(session);
  vi.mocked(openSocialCheckoutSession).mockReset().mockResolvedValue(undefined);
  vi.mocked(authApi.me).mockReset().mockResolvedValue({ user: { id: admin.id, email: admin.email, full_name: admin.name, is_active: true, is_platform_admin: false }, workspaces: [{ id: admin.workspaceId, name: admin.workspaceName, plan: "growth", role: "owner", social_level: "admin" }] });
});
afterEach(() => { cleanup(); localStorage.clear(); });

describe("BillingOverview", () => {
  it("matches landing prices, unlimited accounts and the sales-only Scale offering", async () => {
    vi.mocked(billingApi.listPlans).mockResolvedValue([
      { planKey: "growth", name: "Pro", monthlyPriceInr: 499, monthlyPricePaise: 49900 },
      { planKey: "enterprise", name: "Growth", monthlyPriceInr: 999, monthlyPricePaise: 99900 },
    ]);
    renderBilling();
    await screen.findByText("₹499");
    expect(screen.getByText("₹999")).toBeTruthy();
    expect(screen.getByText("₹4,999")).toBeTruthy();
    expect(screen.getAllByText("Unlimited connected accounts")).toHaveLength(4);
    expect(screen.getByText("2 / Unlimited")).toBeTruthy();
    expect(screen.queryByRole("progressbar", { name: "Connected accounts" })).toBeNull();
    const popular = screen.getByText("Popular").parentElement!;
    expect(within(popular).getByRole("heading", { name: "Growth" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Contact sales" }).getAttribute("href")).toContain("mailto:founder@opsbrainai.com");
    expect(screen.queryByRole("button", { name: "Upgrade to Scale" })).toBeNull();
    expect(billingApi.createCheckout).not.toHaveBeenCalled();
  });

  it("loads usage, live prices, and payment history independently and in parallel", async () => {
    const pending = deferred<SocialDashboardStats["usage"]>();
    vi.mocked(socialMediaApi.getUsage).mockReturnValueOnce(pending.promise);
    renderBilling();
    expect(screen.getByRole("status", { name: "Loading usage" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Loading plans" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Loading payment history" })).toBeTruthy();
    expect(await screen.findByText("₹649.50")).toBeTruthy();
    expect(await screen.findByText("No payments yet")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Loading usage" })).toBeTruthy();
    expect(socialMediaApi.getUsage).toHaveBeenCalledWith("workspace-1");
    expect(socialMediaApi.getDashboardStats).not.toHaveBeenCalled();
    expect(billingApi.listPlans).toHaveBeenCalledWith("workspace-1");
    expect(billingApi.listPayments).toHaveBeenCalledWith("workspace-1");
    await act(async () => pending.resolve(usage));
    expect(screen.getByText("4 / Unlimited")).toBeTruthy();
    expect(screen.queryByRole("progressbar", { name: "Saved templates" })).toBeNull();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("Pay once for 30 days of paid plan access.")).toBeTruthy();
  });

  it("shows real history with payment status, amount, plan display name and coupon", async () => {
    vi.mocked(billingApi.listPayments).mockResolvedValue([payment, { ...payment, id: "payment-2", status: "pending", couponCode: null }]);
    renderBilling();
    expect(await screen.findByText("Payment payment-1")).toBeTruthy();
    expect(screen.getByText("Paid")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByText("Coupon: SAVE")).toBeTruthy();
    expect(screen.getAllByText("₹549.50")).toHaveLength(2);
    expect(screen.getByText(/This is not an invoice/)).toBeTruthy();
  });

  it.each([
    ["usage", "Retry usage"],
    ["prices", "Retry prices"],
    ["history", "Retry payment history"],
  ])("isolates a %s failure and retries only that resource", async (resource, label) => {
    const user = userEvent.setup();
    if (resource === "usage") vi.mocked(socialMediaApi.getUsage).mockRejectedValueOnce(new Error("Offline"));
    if (resource === "prices") vi.mocked(billingApi.listPlans).mockRejectedValueOnce(new Error("Offline"));
    if (resource === "history") vi.mocked(billingApi.listPayments).mockRejectedValueOnce(new Error("Offline"));
    renderBilling();
    await screen.findByRole("alert");
    if (resource === "prices") {
      expect(screen.queryByText("₹499")).toBeNull();
      expect(screen.queryByText("₹999")).toBeNull();
      expect((screen.getByRole("button", { name: "Upgrade to Pro" }) as HTMLButtonElement).disabled).toBe(true);
    } else expect(screen.getByText("₹649.50")).toBeTruthy();
    if (resource === "usage") expect(screen.queryByText("8 / 10")).toBeNull();
    await user.click(screen.getByRole("button", { name: label }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(socialMediaApi.getUsage).toHaveBeenCalledTimes(resource === "usage" ? 2 : 1);
    expect(billingApi.listPlans).toHaveBeenCalledTimes(resource === "prices" ? 2 : 1);
    expect(billingApi.listPayments).toHaveBeenCalledTimes(resource === "history" ? 2 : 1);
  });

  it("does not invent prices for missing catalog rows", async () => {
    vi.mocked(billingApi.listPlans).mockResolvedValue([]);
    renderBilling();
    expect(await screen.findAllByText("Price unavailable")).toHaveLength(2);
    expect((screen.getByRole("button", { name: "Upgrade to Pro" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Refresh prices" })).toBeTruthy();
    expect(screen.queryByText("₹0")).toBeNull();
  });

  it("keeps zero usage limits distinct from unlimited", async () => {
    vi.mocked(socialMediaApi.getUsage).mockResolvedValue({ ...usage, postsThisMonth: { used: 1, limit: 0 } });
    renderBilling();
    expect(await screen.findByText("1 / 0")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Posts this month" }).getAttribute("aria-valuenow")).toBe("100");
    expect(screen.getByText("4 / Unlimited")).toBeTruthy();
  });

  it.each(["viewer", "editor", "publisher"] as const)("disables all upgrade actions for %s", async (level) => {
    renderBilling({ socialPermissionLevel: level });
    await screen.findByText("₹649.50");
    expect(screen.getByText(/Only workspace admins can purchase/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Upgrade to Pro" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Upgrade to Growth" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("preserves plan keys while using catalog display names and disallows lower tiers", async () => {
    vi.mocked(socialMediaApi.getUsage).mockResolvedValue({ ...usage, plan: "growth" });
    vi.mocked(billingApi.createCheckout).mockResolvedValue({ ...session, planKey: "enterprise", listPricePaise: 129900, amountPaise: 129900 });
    renderBilling({ plan: "growth" });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Upgrade to Growth" }));
    await user.click(screen.getByRole("button", { name: "Pay with Razorpay" }));
    await screen.findByText("Payment confirmed");
    expect(billingApi.createCheckout).toHaveBeenCalledWith("workspace-1", "enterprise", undefined);
    expect(openSocialCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({ planKey: "enterprise" }), { workspaceId: "workspace-1", planLabel: "Growth", signal: expect.any(AbortSignal) });
  });

  it("requires coupon validation and sends only the applied code", async () => {
    vi.mocked(billingApi.createCheckout).mockResolvedValue({ ...session, amountPaise: 54950, discountPaise: 10000, couponCode: "SAVE" });
    renderBilling();
    const user = await openCheckout();
    await user.type(screen.getByLabelText(/Coupon code/), "save");
    expect((screen.getByRole("button", { name: "Pay with Razorpay" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText(/SAVE applied/)).toBeTruthy();
    expect(billingApi.validateCoupon).toHaveBeenCalledWith("workspace-1", "growth", "SAVE");
    await user.click(screen.getByRole("button", { name: "Pay with Razorpay" }));
    await screen.findByText("Payment confirmed");
    expect(billingApi.createCheckout).toHaveBeenCalledWith("workspace-1", "growth", "SAVE");
    expect(socialMediaApi.getUsage).toHaveBeenCalledTimes(2);
    expect(billingApi.listPayments).toHaveBeenCalledTimes(2);
    expect(authApi.me).toHaveBeenCalledTimes(1);
  });

  it("rejects stale coupon success after typing a new code", async () => {
    const pending = deferred<CouponPreview>();
    vi.mocked(billingApi.validateCoupon).mockReturnValueOnce(pending.promise);
    renderBilling();
    const user = await openCheckout();
    const input = screen.getByLabelText(/Coupon code/);
    await user.type(input, "SAVE");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await user.clear(input);
    await user.type(input, "NEW");
    await act(async () => pending.resolve(coupon));
    expect(screen.queryByText(/SAVE applied/)).toBeNull();
    expect((screen.getByRole("button", { name: "Pay with Razorpay" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("rejects stale coupon errors after closing and choosing a different plan", async () => {
    const pending = deferred<CouponPreview>();
    vi.mocked(billingApi.validateCoupon).mockReturnValueOnce(pending.promise);
    renderBilling();
    const user = await openCheckout();
    await user.type(screen.getByLabelText(/Coupon code/), "SAVE");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Upgrade to Growth" }));
    await act(async () => pending.reject(new Error("Old coupon failure")));
    expect(screen.queryByText("Old coupon failure")).toBeNull();
    expect((screen.getByLabelText(/Coupon code/) as HTMLInputElement).value).toBe("");
    expect(within(screen.getByRole("dialog")).getAllByText("₹1,299")).toHaveLength(2);
  });

  it("keeps coupon errors in the dialog and allows clearing the code", async () => {
    vi.mocked(billingApi.validateCoupon).mockRejectedValue(new Error("Coupon expired"));
    renderBilling();
    const user = await openCheckout();
    await user.type(screen.getByLabelText(/Coupon code/), "SAVE");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveProperty("textContent", "Coupon expired");
    await user.clear(screen.getByLabelText(/Coupon code/));
    expect(screen.queryByText("Coupon expired")).toBeNull();
    expect((screen.getByRole("button", { name: "Pay with Razorpay" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("supports a fully discounted plan without inventing a recurring subscription", async () => {
    vi.mocked(billingApi.validateCoupon).mockResolvedValue({ ...coupon, amountPaise: 0, discountPaise: 64950 });
    vi.mocked(billingApi.createCheckout).mockResolvedValue({ ...session, mode: "free", amountPaise: 0, discountPaise: 64950, couponCode: "SAVE" });
    renderBilling();
    const user = await openCheckout();
    await user.type(screen.getByLabelText(/Coupon code/), "SAVE");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await user.click(await screen.findByRole("button", { name: "Activate plan" }));
    await screen.findByText("Payment confirmed");
    expect(openSocialCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({ mode: "free" }), expect.any(Object));
  });

  it("blocks duplicate checkout, edits, Escape, close and cancel during payment", async () => {
    const pending = deferred<void>();
    vi.mocked(openSocialCheckoutSession).mockReturnValueOnce(pending.promise);
    renderBilling();
    const user = await openCheckout();
    await user.dblClick(screen.getByRole("button", { name: "Pay with Razorpay" }));
    expect(billingApi.createCheckout).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText(/Coupon code/) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => pending.resolve());
    await screen.findByRole("button", { name: "Done" });
  });

  it.each(["creation", "checkout"])("shows %s failure in the dialog and permits retry", async (stage) => {
    if (stage === "creation") vi.mocked(billingApi.createCheckout).mockRejectedValueOnce(new Error("Payment unavailable"));
    else vi.mocked(openSocialCheckoutSession).mockRejectedValueOnce(new Error("Payment cancelled"));
    renderBilling();
    const user = await openCheckout();
    await user.click(screen.getByRole("button", { name: "Pay with Razorpay" }));
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toBeTruthy();
    expect(authApi.me).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Pay with Razorpay" }));
    await screen.findByText("Payment confirmed");
  });

  it("keeps payment success distinct from a failed session refresh", async () => {
    vi.mocked(authApi.me).mockRejectedValueOnce(new Error("Offline"));
    const { store } = renderBilling();
    const user = await openCheckout();
    await user.click(screen.getByRole("button", { name: "Pay with Razorpay" }));
    expect(await screen.findByText("Payment confirmed")).toBeTruthy();
    expect(store.getState().auth.isAuthenticated).toBe(true);
    expect(store.getState().auth.accessToken).toBe("test-token");
    await user.click(await screen.findByRole("button", { name: "Refresh session" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Refresh session" })).toBeNull());
    expect(billingApi.createCheckout).toHaveBeenCalledTimes(1);
    expect(authApi.me).toHaveBeenCalledTimes(2);
  });

  it("discards old workspace requests and resets an open checkout on a workspace switch", async () => {
    const oldUsage = deferred<SocialDashboardStats["usage"]>();
    const oldHistory = deferred<BillingPayment[]>();
    vi.mocked(socialMediaApi.getUsage).mockReturnValueOnce(oldUsage.promise).mockResolvedValueOnce({ ...usage, postsThisMonth: { used: 99, limit: null } });
    vi.mocked(billingApi.listPayments).mockReturnValueOnce(oldHistory.promise);
    const { store } = renderBilling();
    await openCheckout();
    act(() => store.dispatch({ type: "test/user", payload: { workspaceId: "workspace-2" } }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByText("99 / Unlimited")).toBeTruthy();
    await act(async () => { oldUsage.resolve(usage); oldHistory.resolve([payment]); });
    expect(screen.queryByText("8 / 10")).toBeNull();
    expect(screen.queryByText("Payment payment-1")).toBeNull();
    expect(billingApi.listPlans).toHaveBeenLastCalledWith("workspace-2");
  });

  it("does not open a late checkout session or refresh another workspace", async () => {
    const pending = deferred<CheckoutSession>();
    vi.mocked(billingApi.createCheckout).mockReturnValueOnce(pending.promise);
    const { store } = renderBilling();
    const user = await openCheckout();
    await user.click(screen.getByRole("button", { name: "Pay with Razorpay" }));
    act(() => store.dispatch({ type: "test/user", payload: { workspaceId: "workspace-2" } }));
    await act(async () => pending.resolve(session));
    expect(openSocialCheckoutSession).not.toHaveBeenCalled();
    expect(authApi.me).not.toHaveBeenCalled();
  });

  it("enforces permission changes while checkout is open", async () => {
    const { store } = renderBilling();
    const user = await openCheckout();
    act(() => store.dispatch({ type: "test/user", payload: { socialPermissionLevel: "viewer" } }));
    expect((screen.getByRole("button", { name: "Pay with Razorpay" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Pay with Razorpay" }));
    expect(billingApi.createCheckout).not.toHaveBeenCalled();
  });

  it("does not fetch billing without a workspace", () => {
    renderBilling({ workspaceId: "" });
    expect(screen.getByText("Select a workspace to view billing.")).toBeTruthy();
    expect(billingApi.listPlans).not.toHaveBeenCalled();
  });

  it.each([NaN, Infinity, -1, 64950.5, Number.MAX_SAFE_INTEGER + 1])("blocks checkout for an invalid live paise price: %s", async (price) => {
    vi.mocked(billingApi.listPlans).mockResolvedValue([{ ...prices[0], monthlyPricePaise: price }, prices[1]]);
    renderBilling();
    expect(await screen.findByText("Price unavailable")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Upgrade to Pro" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Upgrade to Growth" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("allows platform admins to purchase without changing the workspace permission contract", async () => {
    renderBilling({ isPlatformAdmin: true, socialPermissionLevel: "viewer" });
    await openCheckout();
    expect(screen.getByRole("dialog", { name: "Upgrade to Pro" })).toBeTruthy();
    expect(screen.queryByText(/Only workspace admins can purchase/)).toBeNull();
  });

  it("does not offer any downgrade or purchase on the highest plan", async () => {
    vi.mocked(socialMediaApi.getUsage).mockResolvedValue({ ...usage, plan: "enterprise" });
    renderBilling({ plan: "enterprise" });
    await screen.findByText("₹649.50");
    expect(screen.queryByRole("button", { name: /Upgrade to/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Not available as an upgrade" })).toHaveLength(2);
    expect((screen.getByRole("button", { name: "Current plan" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("clears an applied coupon when closing and reopening checkout", async () => {
    renderBilling();
    const user = await openCheckout();
    await user.type(screen.getByLabelText(/Coupon code/), "SAVE");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await screen.findByText(/SAVE applied/);
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Upgrade to Pro" }));
    await user.click(screen.getByRole("button", { name: "Upgrade to Pro" }));
    expect((screen.getByLabelText(/Coupon code/) as HTMLInputElement).value).toBe("");
    expect(screen.queryByText(/SAVE applied/)).toBeNull();
    expect(within(screen.getByRole("dialog")).getAllByText("₹649.50")).toHaveLength(2);
  });

  it.each([
    { planKey: "enterprise" },
    { code: "OTHER" },
    { currency: "USD" },
    { amountPaise: -1 },
    { discountPaise: NaN },
    { amountPaise: 54950.5 },
    { discountPaise: 5000 },
    { listPricePaise: 74950, amountPaise: 64950 },
  ])("rejects an inconsistent coupon preview: %o", async (override) => {
    vi.mocked(billingApi.validateCoupon).mockResolvedValue({ ...coupon, ...override });
    renderBilling();
    const user = await openCheckout();
    await user.type(screen.getByLabelText(/Coupon code/), "SAVE");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveProperty("textContent", "Coupon total could not be verified. Refresh prices and try again.");
    expect(screen.queryByText(/SAVE applied/)).toBeNull();
    expect((screen.getByRole("button", { name: "Pay with Razorpay" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Refresh checkout price" }));
    await waitFor(() => expect(billingApi.listPlans).toHaveBeenCalledTimes(2));
  });

  it("rejects an old workspace coupon result even when the same workspace is selected again", async () => {
    const pending = deferred<CouponPreview>();
    vi.mocked(billingApi.validateCoupon).mockReturnValueOnce(pending.promise);
    const { store } = renderBilling();
    const user = await openCheckout();
    await user.type(screen.getByLabelText(/Coupon code/), "SAVE");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    act(() => store.dispatch({ type: "test/user", payload: { workspaceId: "workspace-2" } }));
    await screen.findByText("₹649.50");
    act(() => store.dispatch({ type: "test/user", payload: { workspaceId: "workspace-1" } }));
    await user.click(await screen.findByRole("button", { name: "Upgrade to Pro" }));
    await act(async () => pending.resolve(coupon));
    expect(screen.queryByText(/SAVE applied/)).toBeNull();
    expect((screen.getByLabelText(/Coupon code/) as HTMLInputElement).value).toBe("");
  });

  it("requires review instead of silently accepting a checkout price change", async () => {
    vi.mocked(billingApi.createCheckout).mockResolvedValueOnce({ ...session, listPricePaise: 74950, amountPaise: 74950 });
    vi.mocked(billingApi.listPlans).mockResolvedValueOnce(prices).mockResolvedValue([{ ...prices[0], monthlyPricePaise: 74950 }, prices[1]]);
    renderBilling();
    const user = await openCheckout();
    await user.click(screen.getByRole("button", { name: "Pay with Razorpay" }));
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveProperty("textContent", "Checkout details changed. Review the latest price and apply your coupon again before paying.");
    expect(openSocialCheckoutSession).not.toHaveBeenCalled();
    expect(within(screen.getByRole("dialog")).getAllByText("₹749.50")).toHaveLength(2);
    expect(authApi.me).not.toHaveBeenCalled();
  });

  it("retains the checkout lock across workspace switches until the original gateway settles", async () => {
    const pending = deferred<void>();
    vi.mocked(openSocialCheckoutSession).mockReturnValueOnce(pending.promise);
    const { store } = renderBilling();
    const user = await openCheckout();
    await user.click(screen.getByRole("button", { name: "Pay with Razorpay" }));
    const signal = vi.mocked(openSocialCheckoutSession).mock.calls[0][1].signal;
    act(() => store.dispatch({ type: "test/user", payload: { workspaceId: "workspace-2" } }));
    expect(signal?.aborted).toBe(true);
    expect(await screen.findByText(/A checkout is still in progress/)).toBeTruthy();
    await screen.findByText("₹649.50");
    expect((screen.getByRole("button", { name: "Upgrade to Pro" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Upgrade to Pro" }));
    expect(billingApi.createCheckout).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve());
    expect(screen.queryByText(/A checkout is still in progress/)).toBeNull();
    expect(screen.queryByText("Payment confirmed")).toBeNull();
    expect(authApi.me).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Upgrade to Pro" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("does not launch a newly created session after permission is revoked", async () => {
    const pending = deferred<CheckoutSession>();
    vi.mocked(billingApi.createCheckout).mockReturnValueOnce(pending.promise);
    const { store } = renderBilling();
    const user = await openCheckout();
    await user.click(screen.getByRole("button", { name: "Pay with Razorpay" }));
    act(() => store.dispatch({ type: "test/user", payload: { socialPermissionLevel: "viewer" } }));
    await act(async () => pending.resolve(session));
    expect(openSocialCheckoutSession).not.toHaveBeenCalled();
    expect(authApi.me).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps post-payment refresh errors and independent retries in the confirmation dialog", async () => {
    vi.mocked(socialMediaApi.getUsage).mockResolvedValueOnce(usage).mockRejectedValueOnce(new Error("Offline")).mockResolvedValue(usage);
    vi.mocked(billingApi.listPayments).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("Offline")).mockResolvedValue([payment]);
    renderBilling();
    const user = await openCheckout();
    await user.click(screen.getByRole("button", { name: "Pay with Razorpay" }));
    const dialog = await screen.findByRole("dialog", { name: "Payment confirmed" });
    await user.click(await within(dialog).findByRole("button", { name: "Retry updated usage" }));
    await user.click(within(dialog).getByRole("button", { name: "Retry updated payment history" }));
    await waitFor(() => expect(within(dialog).queryAllByRole("alert")).toHaveLength(0));
    expect(billingApi.createCheckout).toHaveBeenCalledTimes(1);
    expect(socialMediaApi.getUsage).toHaveBeenCalledTimes(3);
    expect(billingApi.listPayments).toHaveBeenCalledTimes(3);
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByText("Payment payment-1")).toBeTruthy();
  });

  it("refreshes the selected workspace session rather than switching to the first workspace", async () => {
    const me = await authApi.me();
    vi.mocked(authApi.me).mockClear().mockResolvedValue({ ...me, workspaces: [{ ...me.workspaces[0], id: "other-workspace" }, ...me.workspaces] });
    const { store } = renderBilling();
    const user = await openCheckout();
    await user.click(screen.getByRole("button", { name: "Pay with Razorpay" }));
    await screen.findByRole("button", { name: "Done" });
    expect(store.getState().auth.user?.workspaceId).toBe("workspace-1");
    expect(store.getState().auth.user?.plan).toBe("growth");
  });

  it("discards a pending session refresh after switching workspaces without logging out", async () => {
    const response = await authApi.me();
    const pending = deferred<typeof response>();
    vi.mocked(authApi.me).mockClear().mockReturnValueOnce(pending.promise);
    const { store } = renderBilling();
    const user = await openCheckout();
    await user.click(screen.getByRole("button", { name: "Pay with Razorpay" }));
    await waitFor(() => expect(authApi.me).toHaveBeenCalledTimes(1));
    act(() => store.dispatch({ type: "test/user", payload: { workspaceId: "workspace-2" } }));
    await act(async () => pending.resolve(response));
    expect(store.getState().auth.user?.workspaceId).toBe("workspace-2");
    expect(store.getState().auth.isAuthenticated).toBe(true);
    expect(store.getState().auth.accessToken).toBe("test-token");
  });

  it("discards late prices from the previous workspace", async () => {
    const pending = deferred<BillingPlanPrice[]>();
    vi.mocked(billingApi.listPlans).mockReturnValueOnce(pending.promise).mockResolvedValueOnce([{ ...prices[0], monthlyPricePaise: 88900 }, prices[1]]);
    const { store } = renderBilling();
    act(() => store.dispatch({ type: "test/user", payload: { workspaceId: "workspace-2" } }));
    expect(await screen.findByText("₹889")).toBeTruthy();
    await act(async () => pending.resolve(prices));
    expect(screen.queryByText("₹649.50")).toBeNull();
  });

  it("restores focus to the plan comparison after the purchased plan disables its upgrade button", async () => {
    vi.mocked(socialMediaApi.getUsage).mockResolvedValueOnce(usage).mockResolvedValue({ ...usage, plan: "growth" });
    renderBilling();
    const user = await openCheckout();
    await user.click(screen.getByRole("button", { name: "Pay with Razorpay" }));
    await user.click(await screen.findByRole("button", { name: "Done" }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Find your next level" }));
  });

  it("passes automated accessibility checks for overview and checkout", async () => {
    const { container } = renderBilling();
    await screen.findByText("₹649.50");
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
    const user = await openCheckout();
    expect((await axe(screen.getByRole("dialog"), { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});