import apiClient from "@/api/client";
import type {
  AdminCoupon,
  AdminCouponRedemption,
  BillingPayment,
  BillingPlanPrice,
  CheckoutSession,
  CouponPreview,
  CreateAdminCouponPayload,
} from "@/types/billing";

const workspaceBase = (workspaceId: string) => `/api/v1/workspaces/${workspaceId}/billing`;
const adminBase = "/api/v1/admin/coupons";

export const billingApi = {
  async listPlans(workspaceId: string): Promise<BillingPlanPrice[]> {
    const { data } = await apiClient.get<BillingPlanPrice[]>(`${workspaceBase(workspaceId)}/plans`);
    return data;
  },

  async validateCoupon(
    workspaceId: string,
    planKey: string,
    couponCode: string,
  ): Promise<CouponPreview> {
    const { data } = await apiClient.post<CouponPreview>(
      `${workspaceBase(workspaceId)}/coupons/validate`,
      { planKey, couponCode },
    );
    return data;
  },

  async createCheckout(
    workspaceId: string,
    planKey: string,
    couponCode?: string,
  ): Promise<CheckoutSession> {
    const { data } = await apiClient.post<CheckoutSession>(`${workspaceBase(workspaceId)}/checkout`, {
      planKey,
      couponCode: couponCode || undefined,
    });
    return data;
  },

  async confirmPayment(
    workspaceId: string,
    payload: {
      paymentId: string;
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
    },
  ): Promise<BillingPayment> {
    const { data } = await apiClient.post<BillingPayment>(`${workspaceBase(workspaceId)}/confirm`, payload);
    return data;
  },

  async listPayments(workspaceId: string): Promise<BillingPayment[]> {
    const { data } = await apiClient.get<BillingPayment[]>(`${workspaceBase(workspaceId)}/payments`);
    return data;
  },

  async listCoupons(): Promise<AdminCoupon[]> {
    const { data } = await apiClient.get<AdminCoupon[]>(adminBase);
    return data;
  },

  async createCoupon(payload: CreateAdminCouponPayload): Promise<AdminCoupon> {
    const { data } = await apiClient.post<AdminCoupon>(adminBase, payload);
    return data;
  },

  async updateCoupon(
    couponId: string,
    payload: Partial<CreateAdminCouponPayload> & { isActive?: boolean },
  ): Promise<AdminCoupon> {
    const { data } = await apiClient.patch<AdminCoupon>(`${adminBase}/${couponId}`, payload);
    return data;
  },

  async listCouponRedemptions(couponId?: string): Promise<AdminCouponRedemption[]> {
    const { data } = await apiClient.get<AdminCouponRedemption[]>(`${adminBase}/redemptions`, {
      params: couponId ? { couponId } : undefined,
    });
    return data;
  },
};

export default billingApi;
