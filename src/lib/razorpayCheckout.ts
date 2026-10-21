import billingApi from "@/api/endpoints/billing.api";
import type { CheckoutSession } from "@/types/billing";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export async function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

type OpenCheckoutOptions = {
  workspaceId: string;
  planLabel: string;
  onSuccess?: () => void;
};

/** Opens Razorpay Checkout.js from a billing session returned by the API. */
export async function openSocialCheckoutSession(
  session: CheckoutSession,
  { workspaceId, planLabel, onSuccess }: OpenCheckoutOptions,
): Promise<void> {
  if (session.mode === "free") {
    await billingApi.confirmPayment(workspaceId, { paymentId: session.paymentId });
    onSuccess?.();
    return;
  }

  if (session.mode === "checkout" && session.orderId && session.keyId) {
    const ok = await loadRazorpayScript();
    if (!ok || !window.Razorpay) {
      throw new Error("Could not load Razorpay Checkout");
    }

    await new Promise<void>((resolve, reject) => {
      const rzp = new window.Razorpay!({
        key: session.keyId,
        amount: session.amountPaise,
        currency: session.currency || "INR",
        name: "OpsBrain AI",
        description: `Social Media — ${planLabel}`,
        order_id: session.orderId,
        theme: { color: "#4F46E5" },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await billingApi.confirmPayment(workspaceId, {
              paymentId: session.paymentId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            onSuccess?.();
            resolve();
          } catch (error) {
            reject(error);
          }
        },
        modal: {
          ondismiss: () => reject(new Error("Payment cancelled")),
        },
      });
      rzp.open();
    });
    return;
  }

  throw new Error("Checkout session is incomplete. Please try again.");
}
