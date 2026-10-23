import billingApi from "@/api/endpoints/billing.api";
import type { CheckoutSession } from "@/types/billing";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on?: (event: string, handler: (response: { error?: { description?: string } }) => void) => void };
  }
}

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let scriptRequest: Promise<boolean> | null = null;

export async function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;
  if (scriptRequest) return scriptRequest;
  scriptRequest = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SCRIPT}"]`);
    const script = existing ?? document.createElement("script");
    const finish = (loaded: boolean) => {
      clearTimeout(timer);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      if (!loaded && !existing) script.remove();
      resolve(loaded);
    };
    const onLoad = () => finish(Boolean(window.Razorpay));
    const onError = () => finish(false);
    const timer = setTimeout(() => finish(Boolean(window.Razorpay)), 15000);
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.src = CHECKOUT_SCRIPT;
      script.async = true;
      document.body.appendChild(script);
    }
  }).finally(() => { scriptRequest = null; });
  return scriptRequest;
}

type OpenCheckoutOptions = {
  workspaceId: string;
  planLabel: string;
  onSuccess?: () => void;
  signal?: AbortSignal;
};

export async function openSocialCheckoutSession(
  session: CheckoutSession,
  { workspaceId, planLabel, onSuccess, signal }: OpenCheckoutOptions,
): Promise<void> {
  const assertActive = () => {
    if (signal?.aborted) throw new Error("Checkout is no longer active. Please try again in the current workspace.");
  };
  assertActive();
  if (session.mode === "free") {
    await billingApi.confirmPayment(workspaceId, { paymentId: session.paymentId });
    onSuccess?.();
    return;
  }

  if (session.mode === "checkout" && session.orderId && session.keyId) {
    const ok = await loadRazorpayScript();
    assertActive();
    if (!ok || !window.Razorpay) {
      throw new Error("Could not load Razorpay Checkout");
    }

    await new Promise<void>((resolve, reject) => {
      let confirming = false;
      let settled = false;
      let failureMessage: string | null = null;
      const fail = (error: unknown) => {
        if (settled || confirming) return;
        settled = true;
        reject(error);
      };
      const rzp = new window.Razorpay!({
        key: session.keyId,
        amount: session.amountPaise,
        currency: session.currency || "INR",
        name: "EarnedVoice",
        description: `Social Media — ${planLabel}`,
        order_id: session.orderId,
        theme: { color: "#4F46E5" },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          if (confirming || settled) return;
          confirming = true;
          try {
            await billingApi.confirmPayment(workspaceId, {
              paymentId: session.paymentId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            settled = true;
            onSuccess?.();
            resolve();
          } catch (error) {
            settled = true;
            reject(error);
          }
        },
        modal: {
          ondismiss: () => fail(new Error(failureMessage || "Payment cancelled")),
        },
      });
      rzp.on?.("payment.failed", (response) => { failureMessage = response.error?.description || "Payment failed. Please try again."; });
      rzp.open();
    });
    return;
  }

  throw new Error("Checkout session is incomplete. Please try again.");
}
