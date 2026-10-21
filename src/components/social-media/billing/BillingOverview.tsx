"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Crown, Loader2, Sparkles, Tag } from "lucide-react";

import billingApi from "@/api/endpoints/billing.api";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { selectUser } from "@/features/auth/authSlice";
import { validateSession } from "@/features/auth/authThunks";
import { DEFAULT_PRICING_CATALOG } from "@/features/admin/pricingCatalog";
import { openSocialCheckoutSession } from "@/lib/razorpayCheckout";
import { hasSocialPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { PlanTier } from "@/types/auth";
import type { BillingPlanPrice, CouponPreview } from "@/types/billing";
import type { SocialDashboardStats } from "@/types/social-media.types";

const PLAN_RANK: Record<PlanTier, number> = {
  starter: 0,
  growth: 1,
  enterprise: 2,
};

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {used.toLocaleString()} / {limit === null ? "Unlimited" : limit.toLocaleString()}
        </span>
      </div>
      {limit !== null ? (
        <Progress value={pct} className="h-1.5" />
      ) : (
        <div className="h-1.5 rounded-full bg-primary/20" />
      )}
    </div>
  );
}

function inrFromCatalog(planId: PlanTier, live?: BillingPlanPrice[]): number | null {
  const liveRow = live?.find((p) => p.planKey === planId);
  if (liveRow) return liveRow.monthlyPriceInr;
  const cat = DEFAULT_PRICING_CATALOG.find((p) => p.id === planId);
  return cat?.priceMonthlyInr ?? null;
}

export default function BillingOverview() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const workspaceId = user?.workspaceId ?? "";
  const canCheckout = hasSocialPermission(user, "admin");

  const [stats, setStats] = useState<SocialDashboardStats | null>(null);
  const [livePrices, setLivePrices] = useState<BillingPlanPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanTier | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    setLoading(true);
    Promise.all([
      socialMediaApi.getDashboardStats(workspaceId),
      billingApi.listPlans(workspaceId).catch(() => [] as BillingPlanPrice[]),
    ])
      .then(([data, prices]) => {
        if (!active) return;
        setStats(data);
        setLivePrices(prices);
      })
      .catch(() => {
        if (active) setError("Failed to load your current usage.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspaceId]);

  const planId: PlanTier = user?.plan ?? "starter";
  const currentPlan =
    DEFAULT_PRICING_CATALOG.find((p) => p.id === planId) ?? DEFAULT_PRICING_CATALOG[0];
  const usage = stats?.usage;

  const usageBars = [
    {
      label: "Posts",
      used: usage?.postsThisMonth.used ?? 0,
      limit: usage?.postsThisMonth.limit ?? currentPlan.limits.postsPerMonth,
    },
    {
      label: "Connected accounts",
      used: usage?.accounts.used ?? 0,
      limit: usage?.accounts.limit ?? currentPlan.limits.accounts,
    },
    {
      label: "Templates",
      used: usage?.templates.used ?? 0,
      limit: usage?.templates.limit ?? currentPlan.limits.templates,
    },
  ];

  const atLimit = usageBars.some(
    (b) => b.limit != null && b.limit > 0 && b.used / b.limit >= 0.8,
  );

  const openCheckout = (target: PlanTier) => {
    setCheckoutPlan(target);
    setCouponCode("");
    setCouponPreview(null);
    setCouponError(null);
    setPaySuccess(false);
    setCheckoutOpen(true);
  };

  const applyCoupon = useCallback(async () => {
    if (!workspaceId || !checkoutPlan || !couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const preview = await billingApi.validateCoupon(
        workspaceId,
        checkoutPlan,
        couponCode.trim(),
      );
      setCouponPreview(preview);
    } catch (e: unknown) {
      setCouponPreview(null);
      const msg =
        e && typeof e === "object" && "response" in e
          ? String((e as { response?: { data?: { detail?: string } } }).response?.data?.detail)
          : "Invalid coupon";
      setCouponError(msg || "Invalid coupon");
    } finally {
      setCouponLoading(false);
    }
  }, [workspaceId, checkoutPlan, couponCode]);

  const startPayment = async () => {
    if (!workspaceId || !checkoutPlan) return;
    setPaying(true);
    setError(null);
    try {
      const session = await billingApi.createCheckout(
        workspaceId,
        checkoutPlan,
        couponPreview?.code || couponCode.trim() || undefined,
      );
      const planName =
        DEFAULT_PRICING_CATALOG.find((p) => p.id === checkoutPlan)?.name ?? checkoutPlan;
      await openSocialCheckoutSession(session, {
        workspaceId,
        planLabel: planName,
        onSuccess: async () => {
          setPaySuccess(true);
          await dispatch(validateSession());
        },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Payment failed";
      setError(msg);
    } finally {
      setPaying(false);
    }
  };

  const checkoutPlanMeta = checkoutPlan
    ? DEFAULT_PRICING_CATALOG.find((p) => p.id === checkoutPlan)
    : null;
  const listInr = checkoutPlan ? inrFromCatalog(checkoutPlan, livePrices) : null;
  const payableInr =
    couponPreview != null
      ? couponPreview.amountPaise / 100
      : listInr;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing & plans</h1>
          <p className="text-sm text-muted-foreground">
            Free by default. Upgrade to Pro (₹499/mo) or Growth (₹999/mo) with Razorpay — coupons
            supported at checkout.
          </p>
        </div>
        {canCheckout && planId !== "enterprise" && (
          <Button
            className="gap-1.5"
            onClick={() => openCheckout(planId === "starter" ? "growth" : "enterprise")}
          >
            <Crown className="h-4 w-4" /> Upgrade now
          </Button>
        )}
      </header>

      {error && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Current plan</CardTitle>
            <CardDescription>Your subscription and usage this month.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{currentPlan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {planId === "starter"
                      ? "Free forever"
                      : `₹${inrFromCatalog(planId, livePrices)?.toLocaleString("en-IN") ?? "—"}/mo`}
                  </p>
                </div>
              </div>
              <Badge variant="secondary">Active</Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))
                : usageBars.map((b) => (
                    <UsageBar
                      key={b.label}
                      label={b.label}
                      used={b.used}
                      limit={b.limit}
                    />
                  ))}
            </div>

            {atLimit && canCheckout && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <span className="font-medium text-foreground">
                  You&apos;re close to your plan limit.
                </span>{" "}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => openCheckout(planId === "starter" ? "growth" : "enterprise")}
                >
                  Upgrade to keep publishing.
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payments</CardTitle>
            <CardDescription>Secure checkout via Razorpay (UPI, cards, netbanking).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 text-success" />
                Pro — ₹499 / month
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 text-success" />
                Growth — ₹999 / month
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 text-success" />
                Apply a coupon code at checkout
              </li>
            </ul>
            {!canCheckout && (
              <p className="text-xs text-muted-foreground">
                Only workspace admins can purchase or upgrade plans.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plans</CardTitle>
          <CardDescription>Self-serve upgrades in INR. Admins can still assign plans manually.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {DEFAULT_PRICING_CATALOG.map((p) => {
              const isCurrent = p.id === planId;
              const inr = inrFromCatalog(p.id, livePrices);
              const canBuy =
                canCheckout &&
                p.id !== "starter" &&
                PLAN_RANK[p.id] > PLAN_RANK[planId];
              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex flex-col rounded-2xl border p-5",
                    p.recommended
                      ? "border-primary bg-primary/5 shadow-elevated"
                      : "border-border",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{p.name}</p>
                    {p.recommended && <Badge>Popular</Badge>}
                  </div>
                  <div className="mt-3">
                    {p.id === "starter" || inr == null ? (
                      <>
                        <span className="text-3xl font-semibold">₹0</span>
                        <span className="text-sm text-muted-foreground">/mo</span>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl font-semibold">
                          ₹{inr.toLocaleString("en-IN")}
                        </span>
                        <span className="text-sm text-muted-foreground">/mo</span>
                      </>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{p.tagline}</p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {[
                      p.limits.postsPerMonth == null
                        ? "Unlimited posts / month"
                        : `${p.limits.postsPerMonth} posts / month`,
                      p.limits.accounts == null
                        ? "Unlimited connected accounts"
                        : `${p.limits.accounts} connected accounts`,
                      p.limits.brandVoice ? "Brand voice" : "No brand voice",
                      p.limits.approvalWorkflow
                        ? "Approval workflow"
                        : "No approval workflow",
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 text-success" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-5 w-full"
                    variant={isCurrent ? "outline" : p.recommended ? "default" : "outline"}
                    disabled={isCurrent || !canBuy}
                    onClick={() => canBuy && openCheckout(p.id)}
                  >
                    {isCurrent ? "Current plan" : canBuy ? `Upgrade to ${p.name}` : "—"}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {paySuccess ? "You're upgraded!" : `Upgrade to ${checkoutPlanMeta?.name ?? ""}`}
            </DialogTitle>
            <DialogDescription>
              {paySuccess
                ? "Your workspace plan is active. Limits update immediately."
                : listInr != null
                  ? `₹${listInr.toLocaleString("en-IN")}/month — billed once for 30 days of access.`
                  : "Complete checkout to activate your plan."}
            </DialogDescription>
          </DialogHeader>

          {paySuccess ? (
            <DialogFooter>
              <Button onClick={() => setCheckoutOpen(false)}>Done</Button>
            </DialogFooter>
          ) : (
            <>
              <div className="space-y-3 py-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" /> Coupon code
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        setCouponPreview(null);
                        setCouponError(null);
                      }}
                      placeholder="Optional"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!couponCode.trim() || couponLoading}
                      onClick={applyCoupon}
                    >
                      {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                  {couponError && (
                    <p className="text-xs text-destructive">{couponError}</p>
                  )}
                  {couponPreview && (
                    <p className="text-xs text-success">
                      {couponPreview.code} applied — you pay ₹
                      {(couponPreview.amountPaise / 100).toLocaleString("en-IN")}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm flex justify-between">
                  <span>Total due today</span>
                  <span className="font-semibold">
                    {payableInr != null
                      ? `₹${payableInr.toLocaleString("en-IN")}`
                      : "—"}
                  </span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCheckoutOpen(false)}>Cancel</Button>
                <Button onClick={startPayment} disabled={paying || listInr == null}>
                  {paying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…
                    </>
                  ) : (
                    "Pay with Razorpay"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
