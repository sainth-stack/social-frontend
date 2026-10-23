import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import billingApi from "@/api/endpoints/billing.api";
import { loadRazorpayScript, openSocialCheckoutSession } from "./razorpayCheckout";
import type { CheckoutSession } from "@/types/billing";

vi.mock("@/api/endpoints/billing.api", () => ({ default: { confirmPayment: vi.fn() } }));

const src = "https://checkout.razorpay.com/v1/checkout.js";
const session: CheckoutSession = { mode: "checkout", provider: "razorpay", paymentId: "payment-1", planKey: "growth", orderId: "order-1", keyId: "key-1", amountPaise: 49900, currency: "INR", listPricePaise: 49900, discountPaise: 0 };
const options = { workspaceId: "workspace-1", planLabel: "Pro" };
const response = { razorpay_order_id: "order-1", razorpay_payment_id: "rzp-payment-1", razorpay_signature: "signature-1" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function installGateway() {
  let config!: { handler: (value: typeof response) => Promise<void>; modal: { ondismiss: () => void } };
  const open = vi.fn();
  const on = vi.fn();
  window.Razorpay = class {
    constructor(options: Record<string, unknown>) { config = options as typeof config; }
    open = open;
    on = on;
  };
  return { open, on, get config() { return config; } };
}

beforeEach(() => {
  delete window.Razorpay;
  vi.mocked(billingApi.confirmPayment).mockReset().mockResolvedValue({ id: "payment-1", workspaceId: "workspace-1", planKey: "growth", status: "paid", amountPaise: 49900, currency: "INR", createdAt: "2026-10-22" });
});
afterEach(() => {
  vi.useRealTimers();
  document.querySelectorAll(`script[src="${src}"]`).forEach((script) => script.remove());
  delete window.Razorpay;
});

describe("loadRazorpayScript", () => {
  it("reuses a ready checkout SDK", async () => {
    window.Razorpay = class { open() {} };
    expect(await loadRazorpayScript()).toBe(true);
    expect(document.querySelectorAll(`script[src="${src}"]`)).toHaveLength(0);
  });

  it("deduplicates concurrent requests and checks SDK availability on load", async () => {
    const first = loadRazorpayScript();
    const second = loadRazorpayScript();
    expect(document.querySelectorAll(`script[src="${src}"]`)).toHaveLength(1);
    window.Razorpay = class { open() {} };
    document.querySelector(`script[src="${src}"]`)!.dispatchEvent(new Event("load"));
    expect(await Promise.all([first, second])).toEqual([true, true]);
  });

  it("reuses an existing script without replacing its event handlers", async () => {
    const script = document.createElement("script");
    script.src = src;
    const onLoad = vi.fn();
    script.onload = onLoad;
    document.body.appendChild(script);
    const pending = loadRazorpayScript();
    window.Razorpay = class { open() {} };
    script.dispatchEvent(new Event("load"));
    expect(await pending).toBe(true);
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll(`script[src="${src}"]`)).toHaveLength(1);
  });

  it("removes its failed script and permits retry", async () => {
    const pending = loadRazorpayScript();
    document.querySelector(`script[src="${src}"]`)!.dispatchEvent(new Event("error"));
    expect(await pending).toBe(false);
    expect(document.querySelector(`script[src="${src}"]`)).toBeNull();
    const retry = loadRazorpayScript();
    window.Razorpay = class { open() {} };
    document.querySelector(`script[src="${src}"]`)!.dispatchEvent(new Event("load"));
    expect(await retry).toBe(true);
  });

  it("does not claim success when the load event has no SDK", async () => {
    const pending = loadRazorpayScript();
    document.querySelector(`script[src="${src}"]`)!.dispatchEvent(new Event("load"));
    expect(await pending).toBe(false);
  });

  it("times out a stalled script, removes its own script and permits retry", async () => {
    vi.useFakeTimers();
    const pending = loadRazorpayScript();
    await vi.advanceTimersByTimeAsync(15000);
    expect(await pending).toBe(false);
    expect(document.querySelector(`script[src="${src}"]`)).toBeNull();
    const retry = loadRazorpayScript();
    window.Razorpay = class { open() {} };
    document.querySelector(`script[src="${src}"]`)!.dispatchEvent(new Event("load"));
    expect(await retry).toBe(true);
  });

  it("does not remove someone else’s stalled script", async () => {
    vi.useFakeTimers();
    const script = document.createElement("script");
    script.src = src;
    document.body.appendChild(script);
    const pending = loadRazorpayScript();
    await vi.advanceTimersByTimeAsync(15000);
    expect(await pending).toBe(false);
    expect(script.isConnected).toBe(true);
  });
});

describe("openSocialCheckoutSession", () => {
  it("confirms a fully discounted session before success", async () => {
    const onSuccess = vi.fn();
    await openSocialCheckoutSession({ ...session, mode: "free", amountPaise: 0 }, { ...options, onSuccess });
    expect(billingApi.confirmPayment).toHaveBeenCalledWith("workspace-1", { paymentId: "payment-1" });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(document.querySelector(`script[src="${src}"]`)).toBeNull();
  });

  it("verifies Razorpay confirmation with the existing API before resolving", async () => {
    const onSuccess = vi.fn();
    const response = { razorpay_order_id: "order-1", razorpay_payment_id: "rzp-payment-1", razorpay_signature: "signature-1" };
    window.Razorpay = class {
      constructor(private config: Record<string, unknown>) { expect(config.name).toBe("EarnedVoice"); }
      open() { void (this.config.handler as (value: typeof response) => Promise<void>)(response); }
    };
    await openSocialCheckoutSession(session, { ...options, onSuccess });
    expect(billingApi.confirmPayment).toHaveBeenCalledWith("workspace-1", { paymentId: "payment-1", razorpayOrderId: "order-1", razorpayPaymentId: "rzp-payment-1", razorpaySignature: "signature-1" });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("propagates cancellation without confirming payment", async () => {
    window.Razorpay = class {
      constructor(private config: Record<string, unknown>) {}
      open() { (this.config.modal as { ondismiss: () => void }).ondismiss(); }
    };
    await expect(openSocialCheckoutSession(session, options)).rejects.toThrow("Payment cancelled");
    expect(billingApi.confirmPayment).not.toHaveBeenCalled();
  });

  it("propagates verification failure without reporting success", async () => {
    vi.mocked(billingApi.confirmPayment).mockRejectedValueOnce(new Error("Verification failed"));
    const onSuccess = vi.fn();
    await expect(openSocialCheckoutSession({ ...session, mode: "free" }, { ...options, onSuccess })).rejects.toThrow("Verification failed");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("rejects incomplete checkout sessions", async () => {
    await expect(openSocialCheckoutSession({ ...session, orderId: null }, options)).rejects.toThrow("Checkout session is incomplete");
  });

  it("reports a script loading failure without confirming a payment", async () => {
    const pending = openSocialCheckoutSession(session, options);
    const rejected = expect(pending).rejects.toThrow("Could not load Razorpay Checkout");
    document.querySelector(`script[src="${src}"]`)!.dispatchEvent(new Event("error"));
    await rejected;
    expect(billingApi.confirmPayment).not.toHaveBeenCalled();
  });

  it("does not create checkout when the originating workspace is already inactive", async () => {
    const gateway = installGateway();
    const controller = new AbortController();
    controller.abort();
    await expect(openSocialCheckoutSession(session, { ...options, signal: controller.signal })).rejects.toThrow("Checkout is no longer active");
    expect(gateway.open).not.toHaveBeenCalled();
    expect(billingApi.confirmPayment).not.toHaveBeenCalled();
  });

  it("does not open a late-loaded SDK after the originating workspace is inactive", async () => {
    const controller = new AbortController();
    const pending = openSocialCheckoutSession(session, { ...options, signal: controller.signal });
    const rejected = expect(pending).rejects.toThrow("Checkout is no longer active");
    controller.abort();
    const gateway = installGateway();
    document.querySelector(`script[src="${src}"]`)!.dispatchEvent(new Event("load"));
    await rejected;
    expect(gateway.open).not.toHaveBeenCalled();
    expect(billingApi.confirmPayment).not.toHaveBeenCalled();
  });

  it("ignores duplicate success callbacks and dismissal while confirmation is pending", async () => {
    const confirmation = deferred<Awaited<ReturnType<typeof billingApi.confirmPayment>>>();
    const payment = await billingApi.confirmPayment("workspace-1", { paymentId: "payment-1" });
    vi.mocked(billingApi.confirmPayment).mockClear().mockReturnValueOnce(confirmation.promise);
    const gateway = installGateway();
    const onSuccess = vi.fn();
    const finished = vi.fn();
    const pending = openSocialCheckoutSession(session, { ...options, onSuccess }).then(finished);
    await vi.waitFor(() => expect(gateway.open).toHaveBeenCalledTimes(1));
    const handler = gateway.config.handler(response);
    await gateway.config.handler(response);
    gateway.config.modal.ondismiss();
    expect(billingApi.confirmPayment).toHaveBeenCalledTimes(1);
    expect(finished).not.toHaveBeenCalled();
    confirmation.resolve(payment);
    await handler;
    await pending;
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it("does not confirm a late success callback after checkout was cancelled", async () => {
    const gateway = installGateway();
    const pending = openSocialCheckoutSession(session, options);
    const rejected = expect(pending).rejects.toThrow("Payment cancelled");
    await vi.waitFor(() => expect(gateway.open).toHaveBeenCalledTimes(1));
    gateway.config.modal.ondismiss();
    await rejected;
    await gateway.config.handler(response);
    expect(billingApi.confirmPayment).not.toHaveBeenCalled();
  });

  it("propagates paid verification errors without resolving or calling success", async () => {
    vi.mocked(billingApi.confirmPayment).mockRejectedValueOnce(new Error("Verification failed"));
    const gateway = installGateway();
    const onSuccess = vi.fn();
    const pending = openSocialCheckoutSession(session, { ...options, onSuccess });
    const rejected = expect(pending).rejects.toThrow("Verification failed");
    await vi.waitFor(() => expect(gateway.open).toHaveBeenCalledTimes(1));
    await gateway.config.handler(response);
    await rejected;
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("keeps checkout pending during gateway retries and reports the gateway error on dismissal", async () => {
    const gateway = installGateway();
    const pending = openSocialCheckoutSession(session, options);
    const rejected = expect(pending).rejects.toThrow("Card was declined");
    await vi.waitFor(() => expect(gateway.open).toHaveBeenCalledTimes(1));
    expect(gateway.on).toHaveBeenCalledWith("payment.failed", expect.any(Function));
    const fail = gateway.on.mock.calls[0][1] as (event: { error: { description: string } }) => void;
    fail({ error: { description: "Card was declined" } });
    expect(billingApi.confirmPayment).not.toHaveBeenCalled();
    gateway.config.modal.ondismiss();
    await rejected;
  });

  it("still verifies a completed payment for its original workspace after a workspace switch", async () => {
    const gateway = installGateway();
    const controller = new AbortController();
    const pending = openSocialCheckoutSession(session, { ...options, signal: controller.signal });
    await vi.waitFor(() => expect(gateway.open).toHaveBeenCalledTimes(1));
    controller.abort();
    await gateway.config.handler(response);
    await pending;
    expect(billingApi.confirmPayment).toHaveBeenCalledWith("workspace-1", expect.objectContaining({ paymentId: "payment-1" }));
  });
});