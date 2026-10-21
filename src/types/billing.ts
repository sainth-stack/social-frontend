export type BillingPlanPrice = {
  planKey: string;
  name: string;
  monthlyPriceInr: number;
  monthlyPricePaise: number;
};

export type CouponPreview = {
  code: string;
  planKey: string;
  listPricePaise: number;
  discountPaise: number;
  amountPaise: number;
  currency: string;
};

export type CheckoutSession = {
  mode: "checkout" | "free";
  provider: string;
  paymentId: string;
  planKey: string;
  orderId?: string | null;
  keyId?: string | null;
  amountPaise: number;
  currency: string;
  listPricePaise: number;
  discountPaise: number;
  couponCode?: string | null;
};

export type BillingPayment = {
  id: string;
  workspaceId: string;
  planKey: string;
  status: string;
  amountPaise: number;
  currency: string;
  couponCode?: string | null;
  createdAt: string;
  paidAt?: string | null;
};

export type AdminCoupon = {
  id: string;
  code: string;
  planKey?: string | null;
  discountType: "percent" | "fixed_inr" | "free";
  discountValue: number;
  maxRedemptions?: number | null;
  redemptionCount: number;
  validUntil?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminCouponRedemption = {
  id: string;
  couponId: string;
  couponCode: string;
  workspaceId: string;
  workspaceName?: string | null;
  userId: string;
  userEmail?: string | null;
  planKey: string;
  amountPaise: number;
  discountPaise: number;
  createdAt: string;
};

export type CreateAdminCouponPayload = {
  code: string;
  planKey?: string | null;
  discountType: "percent" | "fixed_inr" | "free";
  discountValue: number;
  maxRedemptions?: number | null;
  validUntil?: string | null;
  notes?: string | null;
  isActive?: boolean;
};
