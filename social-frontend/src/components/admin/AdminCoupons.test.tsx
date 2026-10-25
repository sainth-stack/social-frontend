import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import billingApi from "@/api/endpoints/billing.api";
import type { AdminCoupon, AdminCouponRedemption } from "@/types/billing";
import AdminCoupons from "./AdminCoupons";

const auth = vi.hoisted(() => ({
  user: { id: "admin", isPlatformAdmin: true } as { id: string; isPlatformAdmin: boolean } | null,
  token: "session-a" as string | null,
  stored: "session-a" as string | null,
}));
vi.mock("@/store/hooks", () => ({ useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { user: auth.user, accessToken: auth.token } }) }));
vi.mock("@/lib/auth/session", () => ({ getStoredAccessToken: () => auth.stored }));
vi.mock("@/api/endpoints/billing.api", () => ({ default: {
  listCoupons: vi.fn(), listCouponRedemptions: vi.fn(), createCoupon: vi.fn(), updateCoupon: vi.fn(),
} }));

const coupon: AdminCoupon = {
  id: "coupon-1", code: "SAVE10", planKey: null, discountType: "percent", discountValue: 10,
  redemptionCount: 1, maxRedemptions: null, validUntil: null, notes: "Launch offer", isActive: true,
  createdAt: "2026-10-20T10:00:00Z", updatedAt: "2026-10-20T10:00:00Z",
};
const redemption: AdminCouponRedemption = {
  id: "redemption-1", couponId: coupon.id, couponCode: coupon.code,
  workspaceId: "workspace-1", workspaceName: "Acme", userId: "user-1", userEmail: "user@example.com",
  planKey: "growth", amountPaise: 44910, discountPaise: 4990, createdAt: "2026-10-20T10:00:00Z",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function apiError(detail: string | { msg: string }[]) {
  return { isAxiosError: true, response: { status: 422, data: { detail } } };
}

async function openCreate() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "New coupon" }));
  return user;
}

function fillCode(value = "save10") {
  fireEvent.change(screen.getByLabelText("Code"), { target: { value } });
}

function submit() {
  fireEvent.submit(screen.getByRole("button", { name: "Create coupon" }).closest("form")!);
}

beforeEach(() => {
  auth.user = { id: "admin", isPlatformAdmin: true };
  auth.token = "session-a";
  auth.stored = "session-a";
  vi.mocked(billingApi.listCoupons).mockReset().mockResolvedValue([]);
  vi.mocked(billingApi.listCouponRedemptions).mockReset().mockResolvedValue([]);
  vi.mocked(billingApi.createCoupon).mockReset().mockResolvedValue(coupon);
  vi.mocked(billingApi.updateCoupon).mockReset().mockResolvedValue({ ...coupon, isActive: false });
});
afterEach(cleanup);

describe("AdminCoupons", () => {
  it("labels mobile offer and redemption cards and retains a single activation action", async () => {
    vi.mocked(billingApi.listCoupons).mockResolvedValue([coupon]);
    vi.mocked(billingApi.listCouponRedemptions).mockResolvedValue([redemption]);
    render(<AdminCoupons />); await screen.findByText("Acme");
    const codes = screen.getByRole("table", { name: "Coupon codes" });
    const history = screen.getByRole("table", { name: "Redemption history" });
    expect(Array.from(codes.querySelectorAll("tbody td")).map((cell) => cell.getAttribute("data-label"))).toEqual(["Code & offer", "Plan", "Redemptions", "Availability", "Actions"]);
    expect(Array.from(history.querySelectorAll("tbody td")).map((cell) => cell.getAttribute("data-label"))).toEqual(["When", "Code", "Workspace / user", "Plan granted", "Discount", "Paid"]);
    expect(screen.getAllByRole("button", { name: "Deactivate SAVE10" })).toHaveLength(1);
  });
  it.each([null, { id: "member", isPlatformAdmin: false }])("does not expose or fetch coupons without administrator access: %j", (user) => {
    auth.user = user;
    render(<AdminCoupons />);
    expect(screen.getByRole("alert").textContent).toContain("Platform administrator access is required");
    expect(screen.queryByRole("button", { name: "New coupon" })).toBeNull();
    expect(billingApi.listCoupons).not.toHaveBeenCalled();
    expect(billingApi.listCouponRedemptions).not.toHaveBeenCalled();
  });

  it.each(["user", "token"] as const)("resets loaded data, drafts and errors when the %s changes", async (change) => {
    vi.mocked(billingApi.listCoupons).mockResolvedValueOnce([coupon]);
    vi.mocked(billingApi.listCouponRedemptions).mockResolvedValueOnce([redemption]);
    vi.mocked(billingApi.createCoupon).mockRejectedValueOnce(apiError("Old creation error"));
    const view = render(<AdminCoupons />);
    await screen.findByText("Acme");
    await openCreate();
    fillCode("OLD-DRAFT");
    submit();
    await screen.findByText("Old creation error");
    if (change === "user") auth.user = { id: "other-admin", isPlatformAdmin: true };
    else auth.token = auth.stored = "session-b";
    view.rerender(<AdminCoupons />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Acme")).toBeNull();
    expect(screen.queryByText("SAVE10")).toBeNull();
    await screen.findByText("No coupons yet");
    await screen.findByText("No redemptions yet");
    expect(billingApi.listCoupons).toHaveBeenCalledTimes(2);
    expect(billingApi.listCouponRedemptions).toHaveBeenCalledTimes(2);
    await openCreate();
    expect((screen.getByLabelText("Code") as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Create coupon" }).matches(":disabled")).toBe(false);
  });

  it("clears confirmation and success notices across sessions", async () => {
    vi.mocked(billingApi.listCoupons).mockResolvedValue([{ ...coupon, isActive: false }]);
    vi.mocked(billingApi.updateCoupon).mockResolvedValue(coupon);
    const view = render(<AdminCoupons />);
    const activate = await screen.findByRole("button", { name: "Activate SAVE10" });
    vi.mocked(billingApi.listCoupons).mockResolvedValue([coupon]);
    fireEvent.click(activate);
    await screen.findByText("SAVE10 activated.");
    fireEvent.click(await screen.findByRole("button", { name: "Deactivate SAVE10" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    auth.token = auth.stored = "session-b";
    view.rerender(<AdminCoupons />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("SAVE10 activated.")).toBeNull();
    await screen.findByRole("button", { name: "Deactivate SAVE10" });
    expect(billingApi.updateCoupon).toHaveBeenCalledTimes(1);
  });

  it.each(["switch", "logout", "stored-switch", "stored-logout"] as const)("ignores late read success and failure after %s", async (change) => {
    const codes = deferred<AdminCoupon[]>();
    const history = deferred<AdminCouponRedemption[]>();
    vi.mocked(billingApi.listCoupons).mockReturnValueOnce(codes.promise);
    vi.mocked(billingApi.listCouponRedemptions).mockReturnValueOnce(history.promise);
    const view = render(<AdminCoupons />);
    auth.stored = change.endsWith("logout") ? null : "session-b";
    if (change === "switch" || change === "logout") {
      auth.token = auth.stored;
      if (change === "logout") auth.user = null;
      view.rerender(<AdminCoupons />);
      if (change === "switch") await screen.findByText("No coupons yet");
    }
    const before = view.container.innerHTML;
    await act(async () => { codes.resolve([coupon]); history.reject(new Error("Old history")); });
    expect(view.container.innerHTML).toBe(before);
    expect(screen.queryByText("SAVE10")).toBeNull();
    expect(screen.queryByText("Old history")).toBeNull();
    expect(billingApi.listCoupons).toHaveBeenCalledTimes(change === "switch" ? 2 : 1);
    expect(billingApi.listCouponRedemptions).toHaveBeenCalledTimes(change === "switch" ? 2 : 1);
  });

  it.each(["switch", "logout", "stored-switch", "stored-logout"] as const)("ignores late read failure and history success after %s", async (change) => {
    const codes = deferred<AdminCoupon[]>();
    const history = deferred<AdminCouponRedemption[]>();
    vi.mocked(billingApi.listCoupons).mockReturnValueOnce(codes.promise);
    vi.mocked(billingApi.listCouponRedemptions).mockReturnValueOnce(history.promise);
    const view = render(<AdminCoupons />);
    auth.stored = change.endsWith("logout") ? null : "session-b";
    if (change === "switch" || change === "logout") {
      auth.token = auth.stored;
      if (change === "logout") auth.user = null;
      view.rerender(<AdminCoupons />);
      if (change === "switch") await screen.findByText("No redemptions yet");
    }
    const before = view.container.innerHTML;
    await act(async () => { codes.reject(new Error("Old codes")); history.resolve([redemption]); });
    expect(view.container.innerHTML).toBe(before);
    expect(screen.queryByText("Acme")).toBeNull();
    expect(screen.queryByText("Old codes")).toBeNull();
  });

  it.each(
    (["create", "activate", "deactivate"] as const).flatMap((action) =>
      (["success", "failure"] as const).flatMap((outcome) =>
        (["switch", "logout", "stored-switch", "stored-logout"] as const).map((change) => ({ action, outcome, change })))),
  )("ignores late $action $outcome after $change without notices, writes or refreshes", async ({ action, outcome, change }) => {
    const pending = deferred<AdminCoupon>();
    vi.mocked(billingApi.listCoupons).mockResolvedValue([{ ...coupon, isActive: action !== "activate" }]);
    vi.mocked(billingApi.createCoupon).mockReturnValueOnce(pending.promise);
    vi.mocked(billingApi.updateCoupon).mockReturnValueOnce(pending.promise);
    const view = render(<AdminCoupons />);
    await screen.findByRole("table", { name: "Coupon codes" });
    if (action === "create") { await openCreate(); fillCode(); submit(); }
    else {
      fireEvent.click(screen.getByRole("button", { name: `${action === "activate" ? "Activate" : "Deactivate"} SAVE10` }));
      if (action === "deactivate") fireEvent.click(screen.getByRole("button", { name: "Deactivate coupon" }));
    }
    auth.stored = change.endsWith("logout") ? null : "session-b";
    if (change === "switch" || change === "logout") {
      auth.token = auth.stored;
      if (change === "logout") auth.user = null;
      view.rerender(<AdminCoupons />);
      expect(screen.queryByRole("dialog")).toBeNull();
      if (change === "switch") {
        await screen.findByRole("table", { name: "Coupon codes" });
        await openCreate();
        fillCode("NEW-DRAFT");
      }
    }
    const before = document.body.innerHTML;
    await act(async () => {
      if (outcome === "success") pending.resolve({ ...coupon, code: "LATE", isActive: action === "activate" });
      else pending.reject(apiError("Late mutation error"));
    });
    expect(document.body.innerHTML).toBe(before);
    expect(screen.queryByText(/LATE (created|activated|deactivated)\./)).toBeNull();
    expect(screen.queryByText("Late mutation error")).toBeNull();
    expect(billingApi.listCoupons).toHaveBeenCalledTimes(change === "switch" ? 2 : 1);
    expect(billingApi.listCouponRedemptions).toHaveBeenCalledTimes(change === "switch" ? 2 : 1);
    expect(billingApi.createCoupon).toHaveBeenCalledTimes(action === "create" ? 1 : 0);
    expect(billingApi.updateCoupon).toHaveBeenCalledTimes(action === "create" ? 0 : 1);
  });

  it.each(["session-b", null])("blocks new reads and mutations when stored authentication changes to %s before rerender", async (stored) => {
    vi.mocked(billingApi.listCoupons).mockResolvedValue([{ ...coupon, isActive: false }]);
    render(<AdminCoupons />);
    await screen.findByRole("button", { name: "Activate SAVE10" });
    auth.stored = stored;
    fireEvent.click(screen.getByRole("button", { name: "Refresh codes" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh history" }));
    fireEvent.click(screen.getByRole("button", { name: "Activate SAVE10" }));
    await openCreate();
    fillCode();
    submit();
    expect(billingApi.listCoupons).toHaveBeenCalledTimes(1);
    expect(billingApi.listCouponRedemptions).toHaveBeenCalledTimes(1);
    expect(billingApi.createCoupon).not.toHaveBeenCalled();
    expect(billingApi.updateCoupon).not.toHaveBeenCalled();
  });

  it("loads both sections independently and never presents pending history as empty", async () => {
    const codes = deferred<AdminCoupon[]>();
    const history = deferred<AdminCouponRedemption[]>();
    vi.mocked(billingApi.listCoupons).mockReturnValueOnce(codes.promise);
    vi.mocked(billingApi.listCouponRedemptions).mockReturnValueOnce(history.promise);
    render(<AdminCoupons />);
    expect(screen.getByRole("status", { name: "Loading coupon codes" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Loading redemption history" })).toBeTruthy();
    expect(screen.queryByText("No redemptions yet")).toBeNull();
    await act(async () => codes.resolve([coupon]));
    expect(screen.getByRole("table", { name: "Coupon codes" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Loading redemption history" })).toBeTruthy();
    await act(async () => history.resolve([]));
    expect(screen.getByText("No redemptions yet")).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/1 loaded/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /next|previous/i })).toBeNull();
  });

  it("provides a creation action for empty codes without fabricating totals", async () => {
    render(<AdminCoupons />);
    await screen.findByText("No coupons yet");
    expect(screen.getByText("No redemptions yet")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Create first coupon" }));
    expect(screen.getByRole("dialog", { name: "Create coupon" })).toBeTruthy();
  });

  it.each(["codes", "history"] as const)("isolates and retries a %s error", async (resource) => {
    if (resource === "codes") vi.mocked(billingApi.listCoupons).mockRejectedValueOnce(apiError("Codes unavailable"));
    else vi.mocked(billingApi.listCouponRedemptions).mockRejectedValueOnce(apiError([{ msg: "History unavailable" }]));
    render(<AdminCoupons />);
    const retry = await screen.findByRole("button", { name: `Retry ${resource}` });
    expect(screen.getByRole("alert").textContent).toContain(resource === "codes" ? "Codes unavailable" : "History unavailable");
    expect(screen.getByText(resource === "codes" ? "No redemptions yet" : "No coupons yet")).toBeTruthy();
    await userEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(billingApi.listCoupons).toHaveBeenCalledTimes(resource === "codes" ? 2 : 1);
    expect(billingApi.listCouponRedemptions).toHaveBeenCalledTimes(resource === "history" ? 2 : 1);
  });

  it("renders truthful availability, known and unknown plans, rupees and paise", async () => {
    vi.mocked(billingApi.listCoupons).mockResolvedValue([
      coupon,
      { ...coupon, id: "fixed", code: "FIXED", planKey: "growth", discountType: "fixed_inr", discountValue: 1250, isActive: false },
      { ...coupon, id: "free", code: "FREE", planKey: "enterprise", discountType: "free", discountValue: 0, maxRedemptions: 1, validUntil: "2020-01-01T00:00:00Z" },
      { ...coupon, id: "legacy", code: "LEGACY", planKey: "legacy", discountValue: 150 },
    ]);
    vi.mocked(billingApi.listCouponRedemptions).mockResolvedValue([
      redemption,
      { ...redemption, id: "r2", workspaceName: null, userEmail: null, planKey: "enterprise", amountPaise: 0, discountPaise: 99900 },
      { ...redemption, id: "r3", planKey: "legacy" },
    ]);
    render(<AdminCoupons />);
    const table = await screen.findByRole("table", { name: "Coupon codes" });
    expect(within(table).getByText("₹1,250 off")).toBeTruthy();
    expect(within(table).getByText("100% off (free)")).toBeTruthy();
    expect(within(table).getByText("100% off")).toBeTruthy();
    expect(within(table).getByText("Expired")).toBeTruthy();
    expect(within(table).getByText("Fully redeemed")).toBeTruthy();
    expect(within(table).getByText("Inactive")).toBeTruthy();
    expect(within(table).getByText("Any paid plan")).toBeTruthy();
    expect(within(table).getByText("Pro")).toBeTruthy();
    expect(within(table).getByText("Growth")).toBeTruthy();
    expect(within(table).getByText("legacy")).toBeTruthy();
    const history = screen.getByRole("table", { name: "Redemption history" });
    expect(within(history).getAllByText("₹449.10")).toHaveLength(2);
    expect(within(history).getAllByText("₹49.90")).toHaveLength(2);
    expect(within(history).getByText("₹999")).toBeTruthy();
    expect(within(history).getByText("₹0")).toBeTruthy();
    expect(within(history).getByText("workspace-1")).toBeTruthy();
    expect(within(history).getByText("user-1")).toBeTruthy();
    expect(within(history).getByText("legacy")).toBeTruthy();
  });

  it("creates normalized codes with the existing defaults, then resets after success", async () => {
    render(<AdminCoupons />);
    const user = await openCreate();
    fillCode("  save-10  ");
    await user.click(screen.getByRole("button", { name: "Create coupon" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(billingApi.createCoupon).toHaveBeenCalledWith({
      code: "SAVE-10", planKey: null, discountType: "percent", discountValue: 10,
      maxRedemptions: null, validUntil: null, notes: "", isActive: true,
    });
    expect(billingApi.listCouponRedemptions).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "New coupon" }));
    expect((screen.getByLabelText("Code") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Discount (%)") as HTMLInputElement).value).toBe("10");
  });

  it.each([
    { type: "percent", value: "25", plan: "growth", expected: 25 },
    { type: "fixed_inr", value: "1200", plan: "enterprise", expected: 1200 },
    { type: "free", value: "89", plan: "growth", expected: 0 },
    { type: "free", value: "89", plan: "enterprise", expected: 0 },
  ])("preserves $type values and $plan keys with all optional fields", async ({ type, value, plan, expected }) => {
    render(<AdminCoupons />);
    const user = await openCreate();
    fillCode();
    fireEvent.change(screen.getByLabelText("Discount (%)"), { target: { value } });
    await user.selectOptions(screen.getByLabelText("Discount type"), type);
    await user.selectOptions(screen.getByLabelText("Applies to"), plan);
    if (type === "free") {
      expect(screen.queryByLabelText("Discount (%)")).toBeNull();
      expect(screen.getByText(/selected eligible plan is granted after checkout/)).toBeTruthy();
    }
    await user.click(screen.getByText("Limits, expiry & internal notes"));
    fireEvent.change(screen.getByLabelText("Max redemptions (optional)"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Expires at (optional)"), { target: { value: "2099-10-24T18:30" } });
    fireEvent.change(screen.getByLabelText("Notes (internal)"), { target: { value: "Partner campaign" } });
    await user.click(screen.getByLabelText("Active immediately"));
    submit();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(billingApi.createCoupon).toHaveBeenCalledWith({
      code: "SAVE10", planKey: plan, discountType: type, discountValue: expected,
      maxRedemptions: 20, validUntil: new Date("2099-10-24T18:30").toISOString(), notes: "Partner campaign", isActive: false,
    });
  });

  it.each([0, 101])("preserves backend percentage semantics for %s with guidance", async (value) => {
    render(<AdminCoupons />);
    await openCreate();
    fillCode();
    fireEvent.change(screen.getByLabelText("Discount (%)"), { target: { value: String(value) } });
    expect(screen.getByText(/Values above 100 are capped at 100%/)).toBeTruthy();
    if (value === 0) expect(screen.getByText(/zero discount can be saved, but cannot be redeemed/)).toBeTruthy();
    submit();
    await waitFor(() => expect(billingApi.createCoupon).toHaveBeenCalledWith(expect.objectContaining({ discountValue: value })));
  });

  it.each(["", "  ab  ", "a".repeat(33)])("validates normalized code length for %j", async (code) => {
    render(<AdminCoupons />);
    await openCreate();
    fillCode(code);
    submit();
    expect(screen.getByRole("alert").textContent).toContain("3–32 characters");
    expect(screen.getByLabelText("Code").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(screen.getByLabelText("Code"));
    expect(billingApi.createCoupon).not.toHaveBeenCalled();
  });

  it.each(["", "-1", "1.5", "9007199254740992"])("rejects invalid discount %j without losing the form", async (value) => {
    render(<AdminCoupons />);
    await openCreate();
    fillCode();
    fireEvent.change(screen.getByLabelText("Discount (%)"), { target: { value } });
    submit();
    expect(screen.getByRole("alert").textContent).toContain("non-negative whole number");
    expect((screen.getByLabelText("Code") as HTMLInputElement).value).toBe("SAVE10");
    expect(billingApi.createCoupon).not.toHaveBeenCalled();
  });

  it.each(["0", "-1", "1.5", "9007199254740992"])("rejects invalid redemption limit %j", async (value) => {
    render(<AdminCoupons />);
    const user = await openCreate();
    fillCode();
    await user.click(screen.getByText("Limits, expiry & internal notes"));
    fireEvent.change(screen.getByLabelText("Max redemptions (optional)"), { target: { value } });
    submit();
    expect(screen.getByRole("alert").textContent).toContain("whole number of at least 1");
    expect(billingApi.createCoupon).not.toHaveBeenCalled();
  });

  it("rejects past expiry, then allows clearing expiry and redemption limits", async () => {
    render(<AdminCoupons />);
    const user = await openCreate();
    fillCode();
    await user.click(screen.getByText("Limits, expiry & internal notes"));
    const expiry = screen.getByLabelText("Expires at (optional)");
    fireEvent.change(expiry, { target: { value: "2020-01-01T12:00" } });
    submit();
    expect(screen.getByRole("alert").textContent).toContain("valid future date and time");
    expect(billingApi.createCoupon).not.toHaveBeenCalled();
    fireEvent.change(expiry, { target: { value: "" } });
    const limit = screen.getByLabelText("Max redemptions (optional)");
    fireEvent.change(limit, { target: { value: "3" } });
    fireEvent.change(limit, { target: { value: "" } });
    submit();
    await waitFor(() => expect(billingApi.createCoupon).toHaveBeenCalledWith(expect.objectContaining({ maxRedemptions: null, validUntil: null })));
  });

  it("keeps every entry on a normalized creation error and permits retry", async () => {
    vi.mocked(billingApi.createCoupon).mockRejectedValueOnce(apiError([{ msg: "Coupon code already exists" }]));
    render(<AdminCoupons />);
    const user = await openCreate();
    fillCode();
    await user.click(screen.getByText("Limits, expiry & internal notes"));
    fireEvent.change(screen.getByLabelText("Notes (internal)"), { target: { value: "Keep me" } });
    submit();
    expect((await screen.findByRole("alert")).textContent).toContain("Coupon code already exists");
    expect((screen.getByLabelText("Code") as HTMLInputElement).value).toBe("SAVE10");
    expect((screen.getByLabelText("Notes (internal)") as HTMLInputElement).value).toBe("Keep me");
    expect(billingApi.listCoupons).toHaveBeenCalledTimes(1);
    fillCode("NEWCODE");
    submit();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(billingApi.createCoupon).toHaveBeenCalledTimes(2);
    expect(billingApi.createCoupon).toHaveBeenLastCalledWith(expect.objectContaining({ code: "NEWCODE", notes: "Keep me" }));
  });

  it("uses a synchronous create mutex and prevents dismissal or editing while saving", async () => {
    const pending = deferred<AdminCoupon>();
    vi.mocked(billingApi.createCoupon).mockReturnValueOnce(pending.promise);
    render(<AdminCoupons />);
    const user = await openCreate();
    fillCode();
    const form = screen.getByRole("button", { name: "Create coupon" }).closest("form")!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(billingApi.createCoupon).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Code").matches(":disabled")).toBe(true);
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => pending.resolve(coupon));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("confirms deactivation, supports cancellation and prevents duplicate toggles", async () => {
    const pending = deferred<AdminCoupon>();
    vi.mocked(billingApi.listCoupons).mockResolvedValue([coupon]);
    vi.mocked(billingApi.updateCoupon).mockReturnValueOnce(pending.promise);
    render(<AdminCoupons />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Deactivate SAVE10" }));
    expect(billingApi.updateCoupon).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(billingApi.updateCoupon).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Deactivate SAVE10" }));
    const confirm = screen.getByRole("button", { name: "Deactivate coupon" });
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm); });
    expect(billingApi.updateCoupon).toHaveBeenCalledTimes(1);
    expect(billingApi.updateCoupon).toHaveBeenCalledWith(coupon.id, { isActive: false });
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeTruthy();
    vi.mocked(billingApi.listCoupons).mockResolvedValue([{ ...coupon, isActive: false }]);
    await act(async () => pending.resolve({ ...coupon, isActive: false }));
    expect(await screen.findByRole("button", { name: "Activate SAVE10" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(billingApi.listCouponRedemptions).toHaveBeenCalledTimes(1);
  });

  it("keeps deactivation errors inside the confirmation and retries", async () => {
    vi.mocked(billingApi.listCoupons).mockResolvedValue([coupon]);
    vi.mocked(billingApi.updateCoupon).mockRejectedValueOnce(apiError("Permission denied"));
    render(<AdminCoupons />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Deactivate SAVE10" }));
    await user.click(screen.getByRole("button", { name: "Deactivate coupon" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Permission denied");
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Deactivate coupon" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(billingApi.updateCoupon).toHaveBeenCalledTimes(2);
  });

  it("activates directly, locks duplicate writes, and preserves row errors for retry", async () => {
    const pending = deferred<AdminCoupon>();
    vi.mocked(billingApi.listCoupons).mockResolvedValue([{ ...coupon, isActive: false }]);
    vi.mocked(billingApi.updateCoupon).mockReturnValueOnce(pending.promise).mockResolvedValue(coupon);
    render(<AdminCoupons />);
    const activate = await screen.findByRole("button", { name: "Activate SAVE10" });
    act(() => { fireEvent.click(activate); fireEvent.click(activate); });
    expect(billingApi.updateCoupon).toHaveBeenCalledTimes(1);
    expect(billingApi.updateCoupon).toHaveBeenCalledWith(coupon.id, { isActive: true });
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => pending.reject(apiError("Activation failed")));
    expect(screen.getByRole("alert").textContent).toContain("Activation failed");
    vi.mocked(billingApi.listCoupons).mockResolvedValue([coupon]);
    await userEvent.click(screen.getByRole("button", { name: "Activate SAVE10" }));
    expect(await screen.findByRole("button", { name: "Deactivate SAVE10" })).toBeTruthy();
    expect(billingApi.updateCoupon).toHaveBeenCalledTimes(2);
  });

  it.each(["codes", "history"] as const)("keeps loaded %s visible if refresh fails", async (resource) => {
    vi.mocked(billingApi.listCoupons).mockResolvedValue([coupon]);
    vi.mocked(billingApi.listCouponRedemptions).mockResolvedValue([redemption]);
    render(<AdminCoupons />);
    await screen.findByText("Acme");
    if (resource === "codes") vi.mocked(billingApi.listCoupons).mockRejectedValueOnce(new Error("Offline"));
    else vi.mocked(billingApi.listCouponRedemptions).mockRejectedValueOnce(new Error("Offline"));
    await userEvent.click(screen.getByRole("button", { name: `Refresh ${resource}` }));
    await screen.findByRole("alert");
    expect(screen.getByText(/Showing previously loaded/)).toBeTruthy();
    expect(screen.getByRole("table", { name: "Coupon codes" })).toBeTruthy();
    expect(screen.getByText("Acme")).toBeTruthy();
  });

  it.each(["success", "failure"] as const)("ignores stale coupon %s after a newer refresh", async (outcome) => {
    const old = deferred<AdminCoupon[]>();
    vi.mocked(billingApi.listCoupons).mockReturnValueOnce(old.promise).mockResolvedValue([{ ...coupon, code: "LATEST" }]);
    render(<AdminCoupons />);
    await userEvent.click(screen.getByRole("button", { name: "Refresh codes" }));
    await screen.findByText("LATEST");
    await act(async () => { if (outcome === "success") old.resolve([coupon]); else old.reject(new Error("Stale failure")); });
    expect(screen.getByText("LATEST")).toBeTruthy();
    expect(screen.queryByText("SAVE10")).toBeNull();
    expect(screen.queryByText("Stale failure")).toBeNull();
  });

  it.each(["success", "failure"] as const)("ignores stale redemption %s after a newer refresh", async (outcome) => {
    const old = deferred<AdminCouponRedemption[]>();
    vi.mocked(billingApi.listCouponRedemptions).mockReturnValueOnce(old.promise).mockResolvedValue([{ ...redemption, workspaceName: "Latest workspace" }]);
    render(<AdminCoupons />);
    await userEvent.click(screen.getByRole("button", { name: "Refresh history" }));
    await screen.findByText("Latest workspace");
    await act(async () => { if (outcome === "success") old.resolve([redemption]); else old.reject(new Error("Stale history")); });
    expect(screen.getByText("Latest workspace")).toBeTruthy();
    expect(screen.queryByText("Acme")).toBeNull();
    expect(screen.queryByText("Stale history")).toBeNull();
  });

  it("invalidates a pre-mutation coupon read when activation succeeds", async () => {
    const old = deferred<AdminCoupon[]>();
    vi.mocked(billingApi.listCoupons).mockResolvedValueOnce([{ ...coupon, isActive: false }]).mockReturnValueOnce(old.promise).mockResolvedValue([coupon]);
    vi.mocked(billingApi.updateCoupon).mockResolvedValue(coupon);
    render(<AdminCoupons />);
    const user = userEvent.setup();
    await screen.findByRole("button", { name: "Activate SAVE10" });
    await user.click(screen.getByRole("button", { name: "Refresh codes" }));
    await user.click(screen.getByRole("button", { name: "Activate SAVE10" }));
    await screen.findByRole("button", { name: "Deactivate SAVE10" });
    await act(async () => old.resolve([{ ...coupon, isActive: false }]));
    expect(screen.getByRole("button", { name: "Deactivate SAVE10" })).toBeTruthy();
  });

  it("retains a successfully created code if the follow-up list refresh fails", async () => {
    vi.mocked(billingApi.listCoupons).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("Refresh failed"));
    render(<AdminCoupons />);
    await openCreate();
    fillCode();
    submit();
    expect(await screen.findByText("SAVE10")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByRole("button", { name: "Retry codes" })).toBeTruthy();
    expect(billingApi.createCoupon).toHaveBeenCalledTimes(1);
  });

  it("retains a new code when creation finishes before the initial list request", async () => {
    const initial = deferred<AdminCoupon[]>();
    vi.mocked(billingApi.listCoupons).mockReturnValueOnce(initial.promise).mockRejectedValueOnce(new Error("Refresh unavailable"));
    render(<AdminCoupons />);
    await openCreate();
    fillCode();
    submit();
    await screen.findByText("SAVE10");
    await screen.findByRole("button", { name: "Retry codes" });
    await act(async () => initial.resolve([]));
    expect(screen.getByText("SAVE10")).toBeTruthy();
    expect(screen.queryByText("No coupons yet")).toBeNull();
  });

  it("guards StrictMode effect generations for both resources", async () => {
    const oldCodes = deferred<AdminCoupon[]>();
    const oldHistory = deferred<AdminCouponRedemption[]>();
    vi.mocked(billingApi.listCoupons).mockReturnValueOnce(oldCodes.promise).mockResolvedValue([]);
    vi.mocked(billingApi.listCouponRedemptions).mockReturnValueOnce(oldHistory.promise).mockResolvedValue([]);
    render(<StrictMode><AdminCoupons /></StrictMode>);
    await screen.findByText("No coupons yet");
    await screen.findByText("No redemptions yet");
    await act(async () => { oldCodes.resolve([coupon]); oldHistory.reject(new Error("Old history")); });
    expect(screen.queryByText("SAVE10")).toBeNull();
    expect(screen.queryByText("Old history")).toBeNull();
  });

  it.each(["success", "failure"] as const)("ignores unmounted read %s without changing a new mount", async (outcome) => {
    const oldCodes = deferred<AdminCoupon[]>();
    const oldHistory = deferred<AdminCouponRedemption[]>();
    vi.mocked(billingApi.listCoupons).mockReturnValueOnce(oldCodes.promise);
    vi.mocked(billingApi.listCouponRedemptions).mockReturnValueOnce(oldHistory.promise);
    const first = render(<AdminCoupons />);
    first.unmount();
    render(<AdminCoupons />);
    await screen.findByText("No coupons yet");
    await act(async () => {
      if (outcome === "success") { oldCodes.resolve([coupon]); oldHistory.resolve([redemption]); }
      else { oldCodes.reject(new Error("Old codes")); oldHistory.reject(new Error("Old history")); }
    });
    expect(screen.getByText("No coupons yet")).toBeTruthy();
    expect(screen.getByText("No redemptions yet")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    { action: "create", outcome: "success" }, { action: "create", outcome: "failure" },
    { action: "activate", outcome: "success" }, { action: "activate", outcome: "failure" },
    { action: "deactivate", outcome: "success" }, { action: "deactivate", outcome: "failure" },
  ])("ignores unmounted $action $outcome and never starts a follow-up read", async ({ action, outcome }) => {
    const pending = deferred<AdminCoupon>();
    vi.mocked(billingApi.listCoupons).mockResolvedValue([{ ...coupon, isActive: action !== "activate" }]);
    vi.mocked(billingApi.createCoupon).mockReturnValueOnce(pending.promise);
    vi.mocked(billingApi.updateCoupon).mockReturnValueOnce(pending.promise);
    const view = render(<AdminCoupons />);
    if (action === "create") { await openCreate(); fillCode(); submit(); }
    else {
      await userEvent.click(await screen.findByRole("button", { name: `${action === "activate" ? "Activate" : "Deactivate"} SAVE10` }));
      if (action === "deactivate") await userEvent.click(screen.getByRole("button", { name: "Deactivate coupon" }));
    }
    view.unmount();
    await act(async () => { if (outcome === "success") pending.resolve(coupon); else pending.reject(apiError("Late error")); });
    expect(billingApi.listCoupons).toHaveBeenCalledTimes(1);
    expect(billingApi.listCouponRedemptions).toHaveBeenCalledTimes(1);
  });

  it("has no axe violations in loaded sections, expanded creation errors, or confirmation", async () => {
    vi.mocked(billingApi.listCoupons).mockResolvedValue([coupon]);
    vi.mocked(billingApi.listCouponRedemptions).mockResolvedValue([redemption]);
    const { container } = render(<AdminCoupons />);
    await screen.findByText("Acme");
    expect((await axe(container)).violations).toEqual([]);
    const user = await openCreate();
    await user.click(screen.getByText("Limits, expiry & internal notes"));
    submit();
    expect((await axe(screen.getByRole("dialog"))).violations).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Deactivate SAVE10" }));
    expect((await axe(screen.getByRole("dialog"))).violations).toEqual([]);
  });
});