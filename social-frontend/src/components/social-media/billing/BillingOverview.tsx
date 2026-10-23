"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { Check, CreditCard, Crown, Loader2, ShieldCheck, Sparkles, Tag } from "lucide-react";
import billingApi from "@/api/endpoints/billing.api";
import { authApi } from "@/api/endpoints/auth.api";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { toApiError } from "@/api/errors";
import { PageHeader } from "@/components/layouts/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { selectUser } from "@/features/auth/authSlice";
import { validateSession } from "@/features/auth/authThunks";
import { DEFAULT_PRICING_CATALOG } from "@/features/admin/pricingCatalog";
import { mapApiUserToUser } from "@/lib/auth/mapUser";
import { openSocialCheckoutSession } from "@/lib/razorpayCheckout";
import { hasSocialPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { PlanTier } from "@/types/auth";
import type { BillingPlanPrice, CouponPreview } from "@/types/billing";

const PLAN_RANK: Record<PlanTier, number> = { starter: 0, growth: 1, enterprise: 2 };
const SCALE_SALES_URL = "mailto:founder@opsbrainai.com?subject=EarnedVoice%20Scale%20plan";
const planName = (key: string) => DEFAULT_PRICING_CATALOG.find((plan) => plan.id === key)?.name ?? key;
const money = (paise: number, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: paise % 100 === 0 ? 0 : 2 }).format(paise / 100);

function useBillingResource<T>(workspaceId: string, fetcher: (workspaceId: string) => Promise<T>, message: string) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({ data: null, loading: true, error: null });
  const request = useRef(0);
  const reload = useCallback(async () => {
    const id = ++request.current;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const data = await fetcher(workspaceId);
      if (id === request.current) setState({ data, loading: false, error: null });
    } catch {
      if (id === request.current) setState((previous) => ({ ...previous, loading: false, error: message }));
    }
  }, [workspaceId, fetcher, message]);
  useEffect(() => {
    void reload();
    return () => { request.current++; };
  }, [reload]);
  return { ...state, reload };
}

function ResourceError({ message, retry, label, disabled = false }: { message: string; retry: () => void; label: string; disabled?: boolean }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm"><p>{message}</p><Button variant="outline" size="sm" disabled={disabled} onClick={retry}>{label}</Button></div>;
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit === null ? 0 : limit === 0 ? (used > 0 ? 100 : 0) : Math.min(100, Math.round((used / limit) * 100));
  return <div className="space-y-2"><div className="flex flex-wrap items-baseline justify-between gap-2 text-sm"><span className="font-medium">{label}</span><span className="text-xs text-muted-foreground">{used.toLocaleString()} / {limit === null ? "Unlimited" : limit.toLocaleString()}</span></div>{limit !== null && <Progress aria-label={label} value={pct} aria-valuenow={pct} aria-valuetext={`${used.toLocaleString()} of ${limit.toLocaleString()}`} className="h-1.5" />}</div>;
}

export default function BillingOverview() {
  const user = useAppSelector(selectUser);
  const checkoutMutex = useRef(false);
  const [paying, setPaying] = useState(false);
  if (!user?.workspaceId) return <div className="space-y-6"><PageHeader icon={CreditCard} title="Billing & plans" description="Manage your workspace plan and payments." /><p role="status" className="rounded-xl border border-border p-6 text-sm text-muted-foreground">Select a workspace to view billing.</p></div>;
  return <WorkspaceBilling key={`${user.id}:${user.workspaceId}`} workspaceId={user.workspaceId} checkoutMutex={checkoutMutex} paying={paying} setPaying={setPaying} />;
}

function WorkspaceBilling({ workspaceId, checkoutMutex, paying, setPaying }: { workspaceId: string; checkoutMutex: MutableRefObject<boolean>; paying: boolean; setPaying: Dispatch<SetStateAction<boolean>> }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const canCheckout = hasSocialPermission(user, "admin");
  const allowed = useRef(canCheckout);
  allowed.current = canCheckout;
  const usage = useBillingResource(workspaceId, socialMediaApi.getUsage, "We couldn’t load your workspace usage.");
  const prices = useBillingResource(workspaceId, billingApi.listPlans, "Live prices are unavailable. Checkout is paused until prices can be verified.");
  const payments = useBillingResource(workspaceId, billingApi.listPayments, "We couldn’t load your payment history.");
  const alive = useRef(true);
  const couponRequest = useRef(0);
  const checkoutController = useRef<AbortController | null>(null);
  const sessionRequest = useRef(0);
  const sessionRefreshing = useRef(false);
  const checkoutTrigger = useRef<HTMLButtonElement | null>(null);
  const plansHeading = useRef<HTMLHeadingElement | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanTier | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshingSession, setRefreshingSession] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      couponRequest.current++;
      checkoutController.current?.abort();
      sessionRequest.current++;
    };
  }, []);
  useEffect(() => {
    if (!canCheckout) checkoutController.current?.abort();
  }, [canCheckout]);

  const planId = (usage.data?.plan ?? user?.plan ?? "starter") as PlanTier;
  const currentPlan = DEFAULT_PRICING_CATALOG.find((plan) => plan.id === planId);
  const livePrice = (key: PlanTier): BillingPlanPrice | undefined => prices.error || prices.loading ? undefined : prices.data?.find((price) => price.planKey === key && Number.isSafeInteger(price.monthlyPricePaise) && price.monthlyPricePaise >= 0);
  const selectedPrice = checkoutPlan ? livePrice(checkoutPlan) : undefined;
  const priceLabel = (key: PlanTier) => key === "starter" ? "Free" : livePrice(key) ? money(livePrice(key)!.monthlyPricePaise) : "Price unavailable";
  const usageBars = usage.data ? [
    { label: "Posts this month", ...usage.data.postsThisMonth },
    { label: "Connected accounts", used: usage.data.accounts.used, limit: null },
    { label: "Saved templates", ...usage.data.templates },
  ] : [];
  const atLimit = usageBars.some((item) => item.limit !== null && (item.limit === 0 ? item.used > 0 : item.used / item.limit >= 0.8));

  const resetCoupon = () => {
    couponRequest.current++;
    setCouponPreview(null);
    setCouponError(null);
    setCouponLoading(false);
  };
  const changeCheckout = (target: PlanTier | null) => {
    if (checkoutMutex.current) return;
    if (target && (!canCheckout || !livePrice(target) || PLAN_RANK[target] <= PLAN_RANK[planId])) return;
    resetCoupon();
    setCouponCode("");
    setPaymentError(null);
    setRefreshError(null);
    setPaySuccess(false);
    setCheckoutPlan(target);
  };
  const applyCoupon = async () => {
    if (!checkoutPlan || !selectedPrice || !couponCode.trim() || checkoutMutex.current || !allowed.current) return;
    const id = ++couponRequest.current;
    const plan = checkoutPlan;
    const code = couponCode.trim();
    setCouponLoading(true);
    setCouponPreview(null);
    setCouponError(null);
    setPaymentError(null);
    try {
      const preview = await billingApi.validateCoupon(workspaceId, plan, code);
      if (alive.current && id === couponRequest.current) {
        if (preview.planKey !== plan || preview.code !== code || preview.currency !== "INR" || preview.listPricePaise !== selectedPrice.monthlyPricePaise || ![preview.amountPaise, preview.discountPaise].every((value) => Number.isSafeInteger(value) && value >= 0) || preview.amountPaise + preview.discountPaise !== preview.listPricePaise) throw new Error("Coupon total could not be verified. Refresh prices and try again.");
        setCouponPreview(preview);
      }
    } catch (error) {
      if (alive.current && id === couponRequest.current) setCouponError(toApiError(error).message);
    } finally {
      if (alive.current && id === couponRequest.current) setCouponLoading(false);
    }
  };
  const refreshSession = async () => {
    if (!alive.current || sessionRefreshing.current) return;
    const id = ++sessionRequest.current;
    sessionRefreshing.current = true;
    setRefreshError(null);
    setRefreshingSession(true);
    try {
      const session = await authApi.me();
      if (!alive.current || id !== sessionRequest.current) return;
      const workspace = session.workspaces.find((workspace) => String(workspace.id) === workspaceId);
      if (!workspace || String(session.user.id) !== user?.id) throw new Error("Session could not be verified.");
      dispatch(validateSession.fulfilled(mapApiUserToUser(session.user, workspace), `${workspaceId}:${id}`, undefined));
    } catch {
      if (alive.current && id === sessionRequest.current) setRefreshError("Payment confirmed, but your session could not refresh. Refresh your session to update plan access.");
    } finally {
      sessionRefreshing.current = false;
      if (alive.current && id === sessionRequest.current) setRefreshingSession(false);
    }
  };
  const startPayment = async () => {
    if (checkoutMutex.current || !allowed.current || !checkoutPlan || !selectedPrice || couponLoading || (couponCode.trim() && !couponPreview) || PLAN_RANK[checkoutPlan] <= PLAN_RANK[planId]) return;
    checkoutMutex.current = true;
    setPaying(true);
    setPaymentError(null);
    couponRequest.current++;
    const controller = new AbortController();
    checkoutController.current = controller;
    try {
      const session = await billingApi.createCheckout(workspaceId, checkoutPlan, couponPreview?.code);
      if (!alive.current || !allowed.current) return;
      if (session.planKey !== checkoutPlan || session.currency !== "INR" || session.listPricePaise !== selectedPrice.monthlyPricePaise || session.amountPaise !== (couponPreview?.amountPaise ?? selectedPrice.monthlyPricePaise) || session.discountPaise !== (couponPreview?.discountPaise ?? 0) || (session.couponCode ?? null) !== (couponPreview?.code ?? null)) {
        resetCoupon();
        void prices.reload();
        throw new Error("Checkout details changed. Review the latest price and apply your coupon again before paying.");
      }
      await openSocialCheckoutSession(session, { workspaceId, planLabel: planName(checkoutPlan), signal: controller.signal });
      if (!alive.current) return;
      setPaySuccess(true);
      await Promise.all([usage.reload(), payments.reload(), refreshSession()]);
    } catch (error) {
      if (alive.current) setPaymentError(toApiError(error).message);
    } finally {
      checkoutController.current = null;
      checkoutMutex.current = false;
      setPaying(false);
    }
  };
  const payable = couponPreview?.amountPaise ?? selectedPrice?.monthlyPricePaise;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader icon={CreditCard} title="Billing & plans" description="A clear view of your plan, workspace usage, and payment history." />
      {!canCheckout && <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Only workspace admins can purchase or upgrade plans. Ask your workspace admin to make changes.</p>}
      {paying && !checkoutPlan && <p role="status" className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">A checkout is still in progress. Finish that payment before starting another.</p>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader><CardTitle role="heading" aria-level={2} className="text-base">Current plan</CardTitle><CardDescription>Workspace access and monthly usage, in one place.</CardDescription></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4"><div className="flex items-center gap-3"><span aria-hidden="true" className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-5" /></span><div><p className="font-semibold">{currentPlan?.name ?? planName(planId)}</p><p className="text-sm text-muted-foreground">{planId === "starter" ? "No payment required" : "Paid plan · 30-day access"}</p></div></div><Badge variant="secondary">Current workspace plan</Badge></div>
            {usage.error && <ResourceError message={usage.error} retry={() => void usage.reload()} label="Retry usage" />}
            {usage.loading ? <div role="status" aria-label="Loading usage" className="grid gap-5 sm:grid-cols-2">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : usage.data && <div className="grid gap-5 sm:grid-cols-2">{usageBars.map((bar) => <UsageBar key={bar.label} {...bar} />)}<div className="space-y-1 text-sm"><p className="font-medium">Workspace features</p><p className="text-xs text-muted-foreground">Brand voice: {usage.data.brandVoice ? "Included" : "Not included"} · Approvals: {usage.data.approvalWorkflow ? "Included" : "Not included"}</p></div></div>}
            {atLimit && !usage.loading && <p className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">You’re approaching or have reached a workspace allowance.{planId !== "enterprise" ? " Compare the plans below for more room to grow." : " Review usage before adding more content."}</p>}
          </CardContent>
        </Card>
        <Card><CardHeader><span aria-hidden="true" className="mb-2 flex size-10 items-center justify-center rounded-xl bg-muted text-primary"><ShieldCheck className="size-5" /></span><CardTitle role="heading" aria-level={2} className="text-base">Simple, secure payments</CardTitle><CardDescription>Pay once for 30 days of paid plan access.</CardDescription></CardHeader><CardContent><ul className="space-y-3 text-sm text-muted-foreground">{["Secure Razorpay checkout", "UPI, cards, and netbanking", "Optional coupon codes", "No automatic recurring charge"].map((text) => <li key={text} className="flex items-start gap-2"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />{text}</li>)}</ul></CardContent></Card>
      </div>
      <section aria-labelledby="plans-heading" className="space-y-4">
        <div><h2 ref={plansHeading} id="plans-heading" tabIndex={-1} className="text-lg font-semibold tracking-tight">Find your next level</h2><p className="mt-1 text-sm text-muted-foreground">Unlimited social accounts on every plan. Self-service upgrades are one-time payments in INR for 30 days of access. Scale is available through sales.</p></div>
        {prices.error && <ResourceError message={prices.error} retry={() => void prices.reload()} label="Retry prices" />}
        {prices.loading ? <div role="status" aria-label="Loading plans" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-80 w-full rounded-2xl" />)}</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{DEFAULT_PRICING_CATALOG.map((plan) => {
          const current = plan.id === planId;
          const higher = PLAN_RANK[plan.id] > PLAN_RANK[planId];
          const price = livePrice(plan.id);
          const features = [
            `${plan.limits.postsPerMonth === null ? "Unlimited" : plan.limits.postsPerMonth} posts / month`,
            "Unlimited connected accounts",
            `${plan.limits.aiTextGenerations === null ? "Unlimited" : plan.limits.aiTextGenerations} AI text generations / month`,
            `${plan.limits.aiImageGenerations === null ? "Unlimited" : plan.limits.aiImageGenerations} AI images / month`,
            `${plan.limits.aiVideoGenerations === null ? "Unlimited" : plan.limits.aiVideoGenerations} AI videos / month`,
            `${plan.limits.templates === null ? "Unlimited" : plan.limits.templates} saved templates`,
            ...(plan.limits.brandVoice ? ["Brand voice"] : []),
            ...(plan.limits.approvalWorkflow ? ["Approval workflow"] : []),
          ];
          return (
            <Card key={plan.id} className={cn("flex flex-col", plan.recommended && "border-primary/40 bg-primary/5 shadow-elevated")}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle role="heading" aria-level={3} className="text-base">{plan.name}</CardTitle>
                  {current ? <Badge variant="secondary">Your plan</Badge> : plan.recommended ? <Badge>Popular</Badge> : null}
                </div>
                <div className="pt-3">
                  <p className="text-3xl font-semibold tracking-tight">{priceLabel(plan.id)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.id === "starter" ? "Start with the essentials" : "One payment · 30 days of access"}</p>
                </div>
                <CardDescription>{plan.tagline}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="mb-6 flex-1 space-y-3 text-sm">
                  {features.map((feature) => <li key={feature} className="flex items-start gap-2"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" /><span className="text-muted-foreground">{feature}</span></li>)}
                </ul>
                <Button variant={plan.recommended && !current ? "default" : "outline"} disabled={current || !higher || !canCheckout || !price || paying} onClick={(event) => { checkoutTrigger.current = event.currentTarget; changeCheckout(plan.id); }}>
                  {current ? "Current plan" : !higher ? "Not available as an upgrade" : `Upgrade to ${plan.name}`}
                </Button>
                {higher && !price && <p className="mt-2 text-xs text-muted-foreground">Live price unavailable. {prices.error ? "Retry prices above." : "Refresh prices to check availability."}</p>}
              </CardContent>
            </Card>
          );
        })}
          <Card className="flex flex-col">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle role="heading" aria-level={3} className="text-base">Scale</CardTitle><Badge variant="outline">Sales-assisted</Badge></div>
              <div className="pt-3"><p className="text-3xl font-semibold tracking-tight">{money(499900)}</p><p className="mt-1 text-xs text-muted-foreground">Per month · Available through sales</p></div>
              <CardDescription>Larger teams and multi-brand operations</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <ul className="mb-6 flex-1 space-y-3 text-sm">{["Unlimited connected accounts", "Tailored monthly post allowance", "Tailored AI text and image allowances", "Brand voice", "Approval workflow"].map((feature) => <li key={feature} className="flex items-start gap-2"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" /><span className="text-muted-foreground">{feature}</span></li>)}</ul>
              <Button variant="outline" asChild><a href={SCALE_SALES_URL}>Contact sales</a></Button>
              <p className="mt-2 text-xs text-muted-foreground">Discuss allowances and activation with sales. Scale is not available in self-service checkout.</p>
            </CardContent>
          </Card>
        </div>}
        {!prices.loading && !prices.error && DEFAULT_PRICING_CATALOG.some((plan) => plan.id !== "starter" && !livePrice(plan.id)) && <Button variant="outline" onClick={() => void prices.reload()}>Refresh prices</Button>}
      </section>
      <Card><CardHeader><CardTitle role="heading" aria-level={2} className="text-base">Payment history</CardTitle><CardDescription>Workspace checkout attempts and confirmed payments. This is not an invoice.</CardDescription></CardHeader><CardContent className="space-y-4">
        {payments.error && <ResourceError message={payments.error} retry={() => void payments.reload()} label="Retry payment history" />}
        {payments.loading ? <div role="status" aria-label="Loading payment history" className="space-y-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div> : payments.data && (payments.data.length === 0 ? <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center"><CreditCard aria-hidden="true" className="mx-auto mb-3 size-6 text-muted-foreground" /><h3 className="text-sm font-medium">No payments yet</h3><p className="mt-1 text-sm text-muted-foreground">Your workspace payment history will appear here after checkout.</p><Button className="mt-4" variant="outline" onClick={() => void payments.reload()}>Refresh payment history</Button></div> : <ul className="divide-y divide-border">{payments.data.map((payment) => {
          const date = new Date(payment.paidAt || payment.createdAt);
          return <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 space-y-1"><p className="text-sm font-medium">{planName(payment.planKey)} <span className="font-normal text-muted-foreground">· {Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></p><p className="break-all text-xs text-muted-foreground">Payment {payment.id}</p>{payment.couponCode && <p className="break-all text-xs text-muted-foreground">Coupon: {payment.couponCode}</p>}</div><div className="flex items-center gap-3"><span className="text-sm font-semibold">{money(payment.amountPaise, payment.currency)}</span><Badge variant={payment.status === "paid" ? "secondary" : "outline"}>{({ paid: "Paid", pending: "Pending", created: "Created", failed: "Failed" } as Record<string, string>)[payment.status] ?? payment.status}</Badge></div></li>;
        })}</ul>)}
      </CardContent></Card>
      <Dialog open={checkoutPlan !== null} onOpenChange={(open) => { if (!open) changeCheckout(null); }}>
        <DialogContent aria-busy={paying} className="max-h-dvh overflow-y-auto" onCloseAutoFocus={(event) => { event.preventDefault(); if (checkoutTrigger.current?.isConnected && !checkoutTrigger.current.disabled) checkoutTrigger.current.focus(); else plansHeading.current?.focus(); }} onEscapeKeyDown={(event) => { if (checkoutMutex.current) event.preventDefault(); }} onInteractOutside={(event) => { if (checkoutMutex.current) event.preventDefault(); }}>
          <DialogHeader><DialogTitle>{paySuccess ? "Payment confirmed" : `Upgrade to ${checkoutPlan ? planName(checkoutPlan) : ""}`}</DialogTitle><DialogDescription>{paySuccess ? "Your payment was confirmed. Workspace usage and payment history have been refreshed where available." : "One payment for 30 days of access. No automatic recurring charge."}</DialogDescription></DialogHeader>
          {paymentError && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm">{paymentError}</p>}
          {!paySuccess && prices.error && <ResourceError message={prices.error} retry={() => { resetCoupon(); void prices.reload(); }} label="Retry checkout price" disabled={paying} />}
          {!paySuccess && !paying && (couponError || paymentError) && <Button variant="outline" disabled={prices.loading} onClick={() => { resetCoupon(); void prices.reload(); }}>Refresh checkout price</Button>}
          {!canCheckout && !paySuccess && <p role="alert" className="text-sm text-destructive">Only workspace admins can complete checkout.</p>}
          {paySuccess ? <>
            {usage.error && <ResourceError message={usage.error} retry={() => void usage.reload()} label="Retry updated usage" disabled={usage.loading} />}
            {payments.error && <ResourceError message={payments.error} retry={() => void payments.reload()} label="Retry updated payment history" disabled={payments.loading} />}
            {refreshError && <ResourceError message={refreshError} retry={() => void refreshSession()} label="Refresh session" disabled={refreshingSession} />}
            <DialogFooter><Button disabled={paying} onClick={() => changeCheckout(null)}>{paying ? "Refreshing…" : "Done"}</Button></DialogFooter>
          </> : <>
            <div className="space-y-4 py-2"><div className="space-y-2"><Label htmlFor="billing-coupon" className="flex items-center gap-2"><Tag aria-hidden="true" className="size-4" />Coupon code <span className="font-normal text-muted-foreground">(optional)</span></Label><div className="flex gap-2"><Input id="billing-coupon" value={couponCode} disabled={paying || !canCheckout} aria-invalid={Boolean(couponError)} aria-describedby={couponError ? "billing-coupon-error" : couponPreview ? "billing-coupon-result" : undefined} onChange={(event) => { resetCoupon(); setCouponCode(event.target.value.toUpperCase()); setPaymentError(null); }} placeholder="Enter a code" /><Button variant="secondary" disabled={!couponCode.trim() || couponLoading || paying || !canCheckout} onClick={() => void applyCoupon()}>{couponLoading ? <><Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin motion-reduce:animate-none" />Applying…</> : "Apply"}</Button></div>{couponError && <p id="billing-coupon-error" role="alert" className="text-xs text-destructive">{couponError}</p>}{couponPreview && <p id="billing-coupon-result" role="status" className="text-xs text-success">{couponPreview.code} applied — you save {money(couponPreview.discountPaise)}</p>}{couponCode.trim() && !couponPreview && !couponLoading && <p className="text-xs text-muted-foreground">Apply this code to verify your total, or clear it to continue without a coupon.</p>}</div><div className="space-y-2 rounded-xl border border-border bg-muted/40 p-4 text-sm"><div className="flex justify-between gap-3"><span className="text-muted-foreground">Plan price</span><span>{selectedPrice ? money(selectedPrice.monthlyPricePaise) : "Price unavailable"}</span></div>{couponPreview && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Coupon discount</span><span>−{money(couponPreview.discountPaise)}</span></div>}<div className="flex justify-between gap-3 border-t border-border pt-2 font-semibold"><span>Total due today</span><span>{payable !== undefined ? money(payable) : "Unavailable"}</span></div></div>{paying && <p role="status" className="text-sm text-muted-foreground">Checkout is in progress. Keep this dialog open until payment verification finishes.</p>}</div>
            <DialogFooter className="gap-2"><Button variant="ghost" disabled={paying} onClick={() => changeCheckout(null)}>Cancel</Button><Button disabled={paying || !canCheckout || !selectedPrice || couponLoading || Boolean(couponCode.trim() && !couponPreview)} onClick={() => void startPayment()}>{paying ? <><Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin motion-reduce:animate-none" />Processing…</> : payable === 0 ? "Activate plan" : <><Crown aria-hidden="true" className="mr-2 size-4" />Pay with Razorpay</>}</Button></DialogFooter>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
